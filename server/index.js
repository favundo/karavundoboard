require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const http = require('http');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// ─── ESET Proxy ───────────────────────────────────────────

let _esetToken = null;
let _esetTokenExpiry = 0;

async function esetGetToken() {
  if (_esetToken && Date.now() < _esetTokenExpiry) return _esetToken;
  const base = process.env.ESET_URL || 'https://antivirus03.in.karavel.com:9443';
  const body = JSON.stringify({ username: process.env.ESET_USER, password: process.env.ESET_PASS });
  const token = await new Promise((resolve, reject) => {
    const url = new URL('/GetTokens', base);
    const req = https.request({
      hostname: url.hostname, port: url.port || 443,
      path: '/GetTokens', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {

        try {
          const json = JSON.parse(data);
          const t = json.token ?? json.access_token ?? json.Token ?? json.accessToken;
          if (!t) return reject(new Error(`No token in response: ${data.slice(0, 200)}`));
          resolve(t);
        } catch (e) { reject(new Error(`Token parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  _esetToken = token;
  _esetTokenExpiry = Date.now() + 50 * 60 * 1000;
  return token;
}

async function esetFetch(path) {
  const token = await esetGetToken();
  const base = process.env.ESET_URL || 'https://antivirus03.in.karavel.com:9443';
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname, port: url.port || 443,
      path: url.pathname + url.search,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null, raw: data.slice(0, 300) }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Cache devices 5 min pour éviter de spammer l'API à chaque FichePoste
let _esetDeviceCache = null;
let _esetDeviceCacheExpiry = 0;

async function esetGetAllDevices() {
  if (_esetDeviceCache && Date.now() < _esetDeviceCacheExpiry) return _esetDeviceCache;
  // On interroge les 4 groupes conteneurs réels (Siège, Agence, Nomades, Abcroisière)
  // plutôt qu'itérer tous les groupes (~100+)
  const DEVICE_GROUP_UUIDS = [
    'af42dc52-9228-4b09-996b-4e68e0ee5d45', // Siège
    '801c4af3-d899-45e9-a790-6e791a46c003', // Agence
    '6c1966b1-dceb-47fa-b87f-f50398995336', // Nomades
    '1d8211b8-ece9-407f-845e-b7a45328435e', // Abcroisière
  ];
  const allDevices = [];
  for (const uuid of DEVICE_GROUP_UUIDS) {
    let pageToken = '';
    do {
      const qs = pageToken ? `?pageToken=${pageToken}` : '';
      const { data: devData } = await esetFetch(`/v1/device_groups/${uuid}/devices${qs}`);
      const devices = devData?.devices ?? devData?.items ?? [];
      allDevices.push(...devices);
      pageToken = devData?.nextPageToken ?? '';
    } while (pageToken);
  }
  _esetDeviceCache = allDevices;
  _esetDeviceCacheExpiry = Date.now() + 5 * 60 * 1000;
  return allDevices;
}

const ESET_STATUS = {
  DEVICE_FUNCTIONALITY_STATUS_OK:      { label: 'Protégé',       color: 'green'  },
  DEVICE_FUNCTIONALITY_STATUS_WARNING: { label: 'Avertissement', color: 'yellow' },
  DEVICE_FUNCTIONALITY_STATUS_ERROR:   { label: 'Non protégé',   color: 'red'    },
};


app.get('/api/eset/computer', async (req, res) => {
  const { dns } = req.query;
  if (!dns) return res.status(400).json({ error: 'Paramètre dns requis' });
  if (!process.env.ESET_USER || !process.env.ESET_PASS) {
    return res.status(503).json({ error: 'ESET_USER / ESET_PASS non configurés' });
  }
  try {
    const devices = await esetGetAllDevices();
    const shortName = dns.split('.')[0].toLowerCase();
    const match = devices.find(d => {
      const n = (d.displayName ?? '').toLowerCase();
      return n === dns.toLowerCase() || n === shortName || n.startsWith(shortName + '.');
    });
    if (!match) return res.status(404).json({ error: 'Ordinateur non trouvé dans ESET' });

    // Fetch détails complets du device
    const { data: detailData } = await esetFetch(`/v1/devices/${match.uuid}`);
    const c = detailData?.device ?? detailData;
    if (!c) return res.status(404).json({ error: 'Détails device ESET introuvables' });

    const status = c.functionalityStatus ?? null;
    const esetUrl = process.env.ESET_URL || 'https://antivirus03.in.karavel.com:9443';
    const avProduct = (c.activeProducts ?? [])[0];

    res.json({
      uuid:              c.uuid,
      name:              c.displayName,
      ip:                c.primaryLocalIpAddress ?? null,
      protectionStatus:  status,
      statusLabel:       ESET_STATUS[status]?.label ?? String(status ?? '?'),
      statusColor:       ESET_STATUS[status]?.color ?? 'gray',
      problemCount:      c.functionalityProblemCount ?? 0,
      antivirusVersion:  avProduct?.version ?? null,
      lastConnectedTime: c.lastSyncTime ?? null,
      operatingSystem:   c.operatingSystem?.displayName ?? null,
      loggedInUsers:     null,
      consoleUrl: `${esetUrl}/protect/computers/detail/${c.uuid}`,
    });
  } catch (err) {
    console.error('[eset]', err.message);
    res.status(500).json({ error: 'Erreur connexion ESET' });
  }
});

// ─── OCS Inventory Proxy ──────────────────────────────────

async function ocsFetch(path) {
  const base = process.env.OCS_URL || 'http://gestion-desktop.in.karavel.com';
  const auth = Buffer.from(`${process.env.OCS_USER}:${process.env.OCS_PASS}`).toString('base64');
  const url = new URL(path, base);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null, raw: data.slice(0, 600) }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Endpoint de diagnostic — accès interne uniquement
app.get('/api/ocs/debug', async (req, res) => {
  if (!process.env.OCS_USER || !process.env.OCS_PASS) {
    return res.json({ error: 'OCS_USER / OCS_PASS non configurés' });
  }
  const { dns } = req.query;
  const shortName = dns ? dns.split('.')[0] : 'TEST';
  try {
    const results = {};

    // 1. Ping : liste les 2 premiers ordinateurs pour vérifier accès + format
    const ping = await ocsFetch('/ocsapi/v1/computers?limit=2');
    results.ping = { status: ping.status, raw: ping.raw ?? null, dataKeys: ping.data ? Object.keys(ping.data) : null, sample: ping.data };

    // 2. Recherche par nom via l'endpoint /search (renvoie une liste d'IDs)
    const qs1 = new URLSearchParams({ start: '0', limit: '20', NAME: shortName.toUpperCase() });
    const r1 = await ocsFetch(`/ocsapi/v1/computers/search?${qs1}`);
    results.searchUpper = { status: r1.status, raw: r1.raw ?? null, ids: ocsExtractIds(r1.data), data: r1.data };

    const qs2 = new URLSearchParams({ start: '0', limit: '20', NAME: shortName.toLowerCase() });
    const r2 = await ocsFetch(`/ocsapi/v1/computers/search?${qs2}`);
    results.searchLower = { status: r2.status, raw: r2.raw ?? null, ids: ocsExtractIds(r2.data), data: r2.data };

    // 3. Détail du premier ID trouvé
    const firstId = ocsExtractIds(r1.data)[0] ?? ocsExtractIds(r2.data)[0] ?? null;
    if (firstId != null) {
      const r3 = await ocsFetch(`/ocsapi/v1/computer/${firstId}`);
      results.detail = { id: firstId, status: r3.status, raw: r3.raw ?? null, data: r3.data };
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OCS 2.x retourne { "ID": { hardware: {...}, bios: [], drives: [], ... } }
function ocsExtractEntry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (!keys.length) return null;
  return data[keys[0]] ?? null;
}

// /computers/search renvoie uniquement une liste d'IDs : [ { "ID": 16 }, ... ]
function ocsExtractIds(data) {
  if (!Array.isArray(data)) return [];
  return data.map(x => x?.ID).filter(v => v != null);
}

function ocsParseComputer(entry) {
  const hw = entry?.hardware ?? {};
  const bios = (entry?.bios ?? [])[0] ?? {};
  // Disque système : on cherche la lettre C: (LETTER vaut "C:/" dans OCS)
  const drives = entry?.drives ?? [];
  const sysDrive = drives.find(d => (d.LETTER ?? '').toUpperCase().startsWith('C:')) ?? null;

  return {
    id:            hw.ID         ?? null,
    name:          hw.NAME       ?? null,
    lastInventory: hw.LASTDATE   ?? hw.LASTCOME ?? null,
    osName:        hw.OSNAME     ?? null,
    ipAddress:     hw.IPADDR     ?? hw.IPSRC    ?? null,
    totalRam:      hw.MEMORY     ? parseInt(hw.MEMORY, 10) : null,
    cpuName:       hw.PROCESSORT ?? null,
    userId:        hw.USERID     ?? null,
    manufacturer:  bios.SMANUFACTURER ?? null,
    model:         bios.SMODEL        ?? null,
    diskTotal:     sysDrive?.TOTAL != null ? parseInt(sysDrive.TOTAL, 10) : null,
    diskFree:      sysDrive?.FREE  != null ? parseInt(sysDrive.FREE, 10)  : null,
  };
}

app.get('/api/ocs/computer', async (req, res) => {
  const { dns } = req.query;
  if (!dns) return res.status(400).json({ error: 'Paramètre dns requis' });
  if (!process.env.OCS_USER || !process.env.OCS_PASS) {
    return res.status(503).json({ error: 'OCS_USER / OCS_PASS non configurés' });
  }
  try {
    const shortName = dns.split('.')[0];
    const base = process.env.OCS_URL || 'http://gestion-desktop.in.karavel.com';

    // 1) Recherche par nom — l'endpoint /search ne renvoie QUE des IDs (LIKE sur la table hardware)
    let ids = [];
    for (const name of [shortName.toUpperCase(), shortName.toLowerCase(), shortName]) {
      const qs = new URLSearchParams({ start: '0', limit: '20', NAME: name });
      const { data } = await ocsFetch(`/ocsapi/v1/computers/search?${qs}`);
      ids = ocsExtractIds(data);
      if (ids.length) break;
    }

    if (!ids.length) {
      console.warn(`[ocs] Poste non trouvé : ${shortName}`);
      return res.status(404).json({ error: 'Ordinateur non trouvé dans OCS' });
    }

    // 2) Détails de chaque candidat : on privilégie la correspondance exacte du nom
    //    (la recherche OCS est un LIKE, elle peut renvoyer plusieurs machines proches)
    const sl = shortName.toLowerCase();
    let found = null;
    let first = null;
    for (const id of ids.slice(0, 10)) {
      const { data } = await ocsFetch(`/ocsapi/v1/computer/${id}`);
      const entry = ocsExtractEntry(data);
      if (!entry) continue;
      if (!first) first = entry;
      if ((entry?.hardware?.NAME ?? '').toLowerCase() === sl) { found = entry; break; }
    }
    found = found ?? first;

    if (!found) {
      console.warn(`[ocs] Détails introuvables : ${shortName}`);
      return res.status(404).json({ error: 'Ordinateur non trouvé dans OCS' });
    }

    const hw = ocsParseComputer(found);
    res.json({
      ...hw,
      consoleUrl: hw.id
        ? `${base}/ocsreports/index.php?function=computer&head=1&val_id=${hw.id}`
        : `${base}/ocsreports/`,
    });
  } catch (err) {
    console.error('[ocs]', err.message);
    res.status(500).json({ error: 'Erreur connexion OCS' });
  }
});

// ─── RT Proxy ─────────────────────────────────────────────

function rtFetch(ticketId) {
  return new Promise((resolve, reject) => {
    const base = process.env.RT_URL || 'http://rt.in.karavel.com';
    const params = new URLSearchParams({ user: process.env.RT_USER, pass: process.env.RT_PASS });
    const url = new URL(`/REST/1.0/ticket/${ticketId}/show`, base);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}?${params}`,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

function parseRTTicket(text) {
  if (!text.match(/^RT\/[\d.]+ 200/)) return null;
  const fields = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Za-z][^:]+):\s*(.+)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return {
    id:          (fields['id'] || '').replace('ticket/', ''),
    subject:     fields['Subject']     || '',
    status:      fields['Status']      || '',
    owner:       fields['Owner']       || '',
    queue:       fields['Queue']       || '',
    created:     fields['Created']     || '',
    lastUpdated: fields['LastUpdated'] || '',
  };
}

app.get('/api/rt/ticket/:id', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  try {
    const text = await rtFetch(req.params.id);
    const ticket = parseRTTicket(text);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
    res.json(ticket);
  } catch (err) {
    console.error('[rt]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

function rtSearch(query) {
  return new Promise((resolve, reject) => {
    const base = process.env.RT_URL || 'http://rt.in.karavel.com';
    const params = new URLSearchParams({ user: process.env.RT_USER, pass: process.env.RT_PASS, query, orderby: '-Created', rows: '5', format: 'l' });
    const url = new URL(`/REST/1.0/search/ticket`, base);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}?${params}`,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

function parseRTSearch(text) {
  if (!text.match(/^RT\/[\d.]+ 200/)) return [];
  const tickets = [];
  for (const block of text.split(/\n--\n/)) {
    if (!block.includes('id: ticket/')) continue;
    const fields = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^([A-Za-z][^:]+):\s*(.+)$/);
      if (m) fields[m[1].trim()] = m[2].trim();
    }
    if (!fields['id']) continue;
    tickets.push({
      id:          fields['id'].replace('ticket/', ''),
      subject:     fields['Subject']     || '',
      status:      fields['Status']      || '',
      owner:       fields['Owner']       || '',
      queue:       fields['Queue']       || '',
      requestors:  fields['Requestors']  || '',
      cc:          fields['Cc']          || '',
      created:     fields['Created']     || '',
      lastUpdated: fields['LastUpdated'] || '',
    });
  }
  return tickets;
}

app.get('/api/rt/search', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  const { asset, uid, nom } = req.query;
  if (!asset && !uid && !nom) return res.status(400).json({ error: 'asset, uid ou nom requis' });

  const parts = [];
  if (asset) parts.push(`Subject LIKE '%${asset}%'`);
  if (uid)   parts.push(`Requestor LIKE '%${uid}%'`);
  if (nom) {
    // "Fabien Vundo" → "fabien.vundo" (sans accents)
    const normalized = nom.trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    const spaceIdx = normalized.indexOf(' ');
    if (spaceIdx > 0) {
      const requestorLogin = normalized.slice(0, spaceIdx) + '.' + normalized.slice(spaceIdx + 1).replace(/\s+/g, '');
      parts.push(`Requestor LIKE '%${requestorLogin}%'`);
    }
  }

  try {
    const text = await rtSearch(parts.join(' OR '));
    res.json(parseRTSearch(text));
  } catch (err) {
    console.error('[rt-search]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

// ─── RT Arrivées (créations de compte / nouveaux collaborateurs) ──────────────
// Les mails RH « [LDAP][RH] Creation de compte: … » créent un ticket dans la
// file « Arrivées … ». Le corps du mail contient des champs structurés qu'on
// reparse pour alimenter l'onglet Arrivées.

function rtGet(pathWithQuery) {
  return new Promise((resolve, reject) => {
    const base = process.env.RT_URL || 'http://rt.in.karavel.com';
    const url = new URL(pathWithQuery, base);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

function rtArriveeSearch() {
  const params = new URLSearchParams({
    user: process.env.RT_USER,
    pass: process.env.RT_PASS,
    // Le sujet « Creation de compte » identifie ces tickets quelle que soit la file.
    query: process.env.RT_ARRIVEE_QUERY || "Subject LIKE 'Creation de compte' AND Status != 'deleted'",
    orderby: '-Created',
    rows: process.env.RT_ARRIVEE_ROWS || '50',
    format: 'l',
  });
  return rtGet(`/REST/1.0/search/ticket?${params}`);
}

function rtTicketHistory(id) {
  const params = new URLSearchParams({ user: process.env.RT_USER, pass: process.env.RT_PASS, format: 'l' });
  return rtGet(`/REST/1.0/ticket/${id}/history?${params}`);
}

// Les champs sont sur une ligne dans le corps du mail ; en sortie RT REST les
// lignes de continuation sont indentées → on tolère un préfixe d'espaces (^\s*).
function rtField(text, re) {
  const m = text.match(re);
  return m ? m[1].replace(/\r/g, '').trim() : null;
}

// Email du responsable : on prend la 1re adresse @karavel du Cc qui n'est ni le
// robot de notification, ni l'expéditeur RH.
function extractResponsableEmail(cc) {
  if (!cc) return null;
  const emails = cc.match(/[\w.+-]+@[\w.-]+\.\w+/g) || [];
  const ignore = /^(notification-creation-compte|rh)@/i;
  return emails.find(e => !ignore.test(e)) || null;
}

function parseArriveeBody(text) {
  return {
    prenom:      rtField(text, /^\s*Pr[ée]?nom\s*:\s*(.+)$/im),
    nom:         rtField(text, /^\s*Nom\s*:\s*(.+)$/im),
    login:       rtField(text, /^\s*Login\s*:\s*(.+)$/im),
    service:     rtField(text, /^\s*Service\s*:\s*(.+)$/im),
    responsable: rtField(text, /^\s*Responsable\s*:\s*(.+)$/im),
    fonction:    rtField(text, /^\s*Fonction\s*:\s*(.+)$/im),
    societe:     rtField(text, /^\s*Soci[ée]t[ée]\s*:\s*(.+)$/im),
    dateArrivee: rtField(text, /^\s*Date d['’]arriv[ée]e\s*:\s*(.+)$/im),
  };
}

app.get('/api/rt/arrivees', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  try {
    const tickets = parseRTSearch(await rtArriveeSearch());
    const arrivals = await Promise.all(tickets.map(async (t) => {
      let body = {};
      try { body = parseArriveeBody(await rtTicketHistory(t.id)); }
      catch (e) { console.error(`[rt-arrivees] history ${t.id}:`, e.message); }
      return { ...t, ...body, responsableEmail: extractResponsableEmail(t.cc) };
    }));
    res.json(arrivals);
  } catch (err) {
    console.error('[rt-arrivees]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

// Envoi du mot de passe au responsable. Le mdp transite par la requête mais
// n'est jamais journalisé ni stocké côté serveur.
app.post('/api/rt/send-mdp', async (req, res) => {
  const { email, prenom, nom, login, mdp } = req.body || {};
  if (!email || !mdp) return res.status(400).json({ error: 'email et mdp requis' });
  if (!/@karavel\.com$/i.test(email)) return res.status(400).json({ error: 'Adresse destinataire invalide' });
  try {
    const fullName = [prenom, nom].filter(Boolean).join(' ') || login || 'le nouveau collaborateur';
    await transporter.sendMail({
      from: 'noreply@karavel.com',
      to: email,
      subject: `Création de compte — identifiants de ${fullName}`,
      text: `Bonjour,

Le compte du nouveau collaborateur a été créé :

  Collaborateur : ${fullName}
  Identifiant   : ${login || '—'}
  Mot de passe  : ${mdp}

Merci de transmettre ces identifiants à l'intéressé(e) et de l'inviter à changer son mot de passe à la première connexion.

Cordialement,
Le support informatique Karavel`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[rt-send-mdp]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clôture du ticket RT (Status: resolved). Nécessite que RT_USER ait les droits.
function rtSetStatus(id, status) {
  return new Promise((resolve, reject) => {
    const base = process.env.RT_URL || 'http://rt.in.karavel.com';
    const body = new URLSearchParams({
      user: process.env.RT_USER,
      pass: process.env.RT_PASS,
      content: `Status: ${status}`,
    }).toString();
    const url = new URL(`/REST/1.0/ticket/${id}/edit`, base);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.post('/api/rt/close', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  const { ticketId } = req.body || {};
  if (!ticketId) return res.status(400).json({ error: 'ticketId requis' });
  try {
    const out = await rtSetStatus(ticketId, 'resolved');
    if (!out.match(/^RT\/[\d.]+ 200/) || /Permission Denied|does not exist|Unable/i.test(out)) {
      console.error('[rt-close]', out.slice(0, 200));
      return res.status(502).json({ error: 'RT a refusé la clôture' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[rt-close]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

// ─── Config ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.in.karavel.com',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: false,
  ignoreTLS: true,
  tls: { rejectUnauthorized: false },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// ─── Technicians (mirrored from frontend) ────────────────
const TECHNICIANS = {
  nehad:         { label: 'Nehad',          email: 'nehad@karavel.com' },
  zkarroum:      { label: 'Z. Karroum',     email: 'zkarroum@karavel.com' },
  maabid:        { label: 'M. Abid',        email: 'maabid@karavel.com' },
  cananthakumar: { label: 'C. Ananthakumar', email: 'cananthakumar@karavel.com' },
  rrinville:     { label: 'R. Rinville',    email: 'rrinville@karavel.com' },
  'ext-favundo': { label: 'F. Avundo',      email: 'ext-favundo@karavel.com' },
  blouis:        { label: 'B. Louis',       email: 'blouis@karavel.com' },
};

const TYPE_LABELS = {
  changement_machine: 'Changement de machine',
  remasterisation:    'Remasterisation',
  demenagement:       'Déménagement',
  installation:       'Installation',
};

// ─── ICS Generator ───────────────────────────────────────
const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const generateIcs = (appt, method = 'REQUEST') => {
  const start = new Date(appt.date_rdv);
  const end = new Date(start.getTime() + appt.duree_minutes * 60 * 1000);
  const tech = TECHNICIANS[appt.uid_technicien] || { label: appt.uid_technicien, email: '' };
  const typeLabel = TYPE_LABELS[appt.type_intervention] || appt.type_intervention;
  const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaravelSupport//FR',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${appt.id}@karavel.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Support IT - ${typeLabel} - ${appt.uid_user}`,
    `DESCRIPTION:Intervention : ${typeLabel}\\nUtilisateur : ${appt.uid_user}\\nTechnicien : ${tech.label}\\nMachine : ${appt.asset}\\nService : ${appt.service}${appt.notes ? '\\nNotes : ' + appt.notes : ''}`,
    'ORGANIZER;CN=Support Informatique:mailto:noreply@karavel.com',
    `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;CN=${appt.uid_user}:mailto:${appt.email_user}`,
    `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;CN=${tech.label}:mailto:${tech.email}`,
    `STATUS:${status}`,
    'CLASS:PUBLIC',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

// ─── Email builders ───────────────────────────────────────
const buildAppointmentBody = (appt) => {
  const start = new Date(appt.date_rdv);
  const end = new Date(start.getTime() + appt.duree_minutes * 60 * 1000);
  const tech = TECHNICIANS[appt.uid_technicien] || { label: appt.uid_technicien };
  const typeLabel = TYPE_LABELS[appt.type_intervention] || appt.type_intervention;

  const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return `Bonjour,

Votre rendez-vous avec le support informatique a bien été enregistré.

Détails de l'intervention :
  Type         : ${typeLabel}
  Date         : ${dateStr}
  Horaire      : ${timeStr}
  Technicien   : ${tech.label}
  Machine      : ${appt.asset}
  Service      : ${appt.service}
${appt.notes ? `  Notes        : ${appt.notes}\n` : ''}
Vous trouverez en pièce jointe une invitation calendrier (.ics).
Pour l'ajouter à Outlook, double-cliquez sur le fichier joint et acceptez l'invitation.

Cordialement,
L'équipe du support informatique Karavel`;
};

const sendEmail = async (appt, type) => {
  const tech = TECHNICIANS[appt.uid_technicien] || { email: '' };
  const typeLabel = TYPE_LABELS[appt.type_intervention] || appt.type_intervention;

  if (type === 'delete') {
    await transporter.sendMail({
      from: 'noreply@karavel.com',
      to: appt.email_user,
      subject: 'Prise de rendez vous avec le support informatique annulé',
      text: `Votre rendez vous avec le support informatique a bien été annulé.\n\nCordialement,\nL'équipe du support informatique.`,
    });
    return;
  }

  if (type === 'close') {
    await transporter.sendMail({
      from: 'noreply@karavel.com',
      to: appt.email_user,
      subject: 'Prise de rendez-vous avec le support informatique : Clôturée',
      text: `Bonjour,

Nous pensons être correctement intervenus sur votre poste (${typeLabel} — ${appt.asset}).
Si vous rencontrez néanmoins un problème, écrivez-nous à sos@karavel.com.

Bonne journée.
L'équipe du support`,
    });
    return;
  }

  const icsMethod = 'REQUEST';
  const icsContent = generateIcs(appt, icsMethod);
  const subject = type === 'update'
    ? 'Prise de rendez-vous avec le support informatique. (Modification)'
    : 'Prise de rendez-vous avec le support informatique.';

  await transporter.sendMail({
    from: 'noreply@karavel.com',
    to: appt.email_user,
    cc: tech.email,
    subject,
    text: buildAppointmentBody(appt),
    attachments: [
      {
        filename: 'rendez-vous-support.ics',
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST; charset=utf-8',
      },
    ],
  });
};

// ─── Route POST /send-email ───────────────────────────────
app.post('/api/send-email', async (req, res) => {
  const { type, appointment } = req.body;
  if (!type || !appointment) {
    return res.status(400).json({ error: 'Missing type or appointment' });
  }
  try {
    await sendEmail(appointment, type);
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-email]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Cron : rappel 24h avant ─────────────────────────────
// Runs every hour — finds appointments starting in 23–25h that haven't been reminded yet
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const to   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('support_appointments')
      .select('*')
      .eq('statut', 'planifie')
      .eq('rappel_envoye', false)
      .gte('date_rdv', from)
      .lte('date_rdv', to);

    if (error) { console.error('[cron]', error.message); return; }
    if (!data || data.length === 0) return;

    for (const appt of data) {
      try {
        const tech = TECHNICIANS[appt.uid_technicien] || { label: appt.uid_technicien, email: '' };
        const start = new Date(appt.date_rdv);
        const typeLabel = TYPE_LABELS[appt.type_intervention] || appt.type_intervention;
        const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        await transporter.sendMail({
          from: 'noreply@karavel.com',
          to: tech.email,
          subject: `[Rappel] Intervention demain — ${typeLabel} — ${appt.uid_user}`,
          text: `Bonjour ${tech.label},

Rappel : vous avez une intervention planifiée demain.

  Type       : ${typeLabel}
  Utilisateur: ${appt.uid_user}
  Date       : ${dateStr} à ${timeStr}
  Machine    : ${appt.asset}
  Service    : ${appt.service}
${appt.notes ? `  Notes      : ${appt.notes}\n` : ''}
Cordialement,
Le système de planning Karavel`,
        });

        await supabase
          .from('support_appointments')
          .update({ rappel_envoye: true })
          .eq('id', appt.id);

        console.log(`[cron] Rappel envoyé pour ${appt.id}`);
      } catch (e) {
        console.error(`[cron] Erreur rappel ${appt.id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[cron]', err.message);
  }
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Serveur email démarré sur le port ${PORT}`);
});
