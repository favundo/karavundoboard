require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const http = require('http');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// ─── Identité de l'utilisateur connecté ───────────────────
//
// Un SPA ne peut pas lire les en-têtes de sa propre page : il lui faut un
// aller-retour pour savoir qui il est. Authelia renseigne Remote-User,
// Remote-Groups, Remote-Name et Remote-Email, et Nginx les RÉÉCRIT vers ce
// serveur (voir authelia-authrequest.conf).
//
// Ces en-têtes ne sont dignes de confiance que parce que DEUX conditions sont
// réunies. Si l'une saute, n'importe qui peut se faire passer pour n'importe
// quel technicien :
//   1. Nginx écrase tout Remote-* venu du client, il ne se contente pas d'ajouter
//   2. ce serveur n'écoute que sur 127.0.0.1 (voir app.listen en fin de fichier)

const GROUP_TECH  = process.env.AUTH_GROUP_TECH  || 'karinventaire-tech';
const GROUP_ADMIN = process.env.AUTH_GROUP_ADMIN || 'karinventaire-admin';

app.get('/api/me', (req, res) => {
  const uid = req.get('Remote-User');

  // En développement il n'y a pas d'Authelia devant. DEV_USER doit être posé
  // explicitement dans server/.env — absent en production, la bascule ne peut
  // donc pas s'y déclencher par accident.
  if (!uid && process.env.DEV_USER) {
    const groups = (process.env.DEV_GROUPS || `${GROUP_TECH},${GROUP_ADMIN}`)
      .split(',').map(g => g.trim()).filter(Boolean);
    return res.json({
      authenticated: true,
      dev: true,
      uid: process.env.DEV_USER,
      displayName: process.env.DEV_USER,
      email: null,
      groups,
      isTech: groups.includes(GROUP_TECH),
      isAdmin: groups.includes(GROUP_ADMIN),
    });
  }

  if (!uid) {
    return res.status(401).json({ authenticated: false });
  }

  const groups = (req.get('Remote-Groups') || '')
    .split(',').map(g => g.trim()).filter(Boolean);

  res.json({
    authenticated: true,
    dev: false,
    uid,
    displayName: req.get('Remote-Name') || uid,
    email: req.get('Remote-Email') || null,
    groups,
    isTech: groups.includes(GROUP_TECH),
    isAdmin: groups.includes(GROUP_ADMIN),
  });
});

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
  // On interroge le groupe racine "Tous" en récursif : une seule passe ramène
  // l'intégralité du parc. Itérer les 4 groupes conteneurs (Siège, Agence,
  // Nomades, Abcroisière) ratait ~111 postes rangés dans d'autres groupes.
  const ROOT_GROUP_UUID = '00000000-0000-0000-7001-000000000001'; // "Tous"
  const allDevices = [];
  let pageToken = '';
  do {
    // recurseSubgroups=true : sinon l'API ne renvoie que les membres directs.
    const params = new URLSearchParams({ recurseSubgroups: 'true', pageSize: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const { data: devData } = await esetFetch(`/v1/device_groups/${ROOT_GROUP_UUID}/devices?${params}`);
    const devices = devData?.devices ?? devData?.items ?? [];
    allDevices.push(...devices);
    pageToken = devData?.nextPageToken ?? '';
  } while (pageToken);
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

// ─── RT Tickets prioritaires (bandeau défilant Support) ──────────────────────
// RT filtre et trie côté serveur : la requête reste sous la seconde même si la
// file contient des centaines de tickets ouverts.

const PRIORITY_MIN    = parseInt(process.env.RT_PRIORITY_MIN || '5', 10);
const PRIORITY_QUEUES = (process.env.RT_PRIORITY_QUEUES || 'sos').split(',').map(q => q.trim()).filter(Boolean);
// RT 4.0.4 n'honore pas `rows` sur /search/ticket : on l'envoie quand même et on
// tronque côté serveur, sinon un seuil bas ferait défiler des centaines d'entrées.
const PRIORITY_ROWS   = parseInt(process.env.RT_PRIORITY_ROWS || '20', 10);

/**
 * Files demandées par le client. Les noms partent dans une requête RT : on ne
 * garde que ce qui ressemble à un nom de file, et on retombe sur la valeur par
 * défaut si la liste est vide.
 */
function parseQueues(raw, fallback) {
  const asked = String(raw || '')
    .split(',')
    .map(q => q.trim())
    .filter(q => /^[\w \-.éèêàçÉÈÊÀÇ]{1,64}$/.test(q));
  return asked.length ? [...new Set(asked)] : fallback;
}

function rtPrioritySearch(min, queues) {
  const queueClause = queues.map(q => `Queue = '${q.replace(/'/g, "\\'")}'`).join(' OR ');
  const query = `(${queueClause}) AND (Status = 'new' OR Status = 'open') AND Priority >= ${min}`;
  const params = new URLSearchParams({
    user: process.env.RT_USER,
    pass: process.env.RT_PASS,
    query,
    orderby: '-Priority',
    rows: String(PRIORITY_ROWS),
    format: 'l',
  });
  return rtGet(`/REST/1.0/search/ticket?${params}`);
}

/**
 * Tronque à `rows` en servant les files à tour de rôle, le plus prioritaire
 * d'abord dans chacune. Une troncature globale coupait tout `sos-agences` : RT
 * rend `sos` en premier et le plafond tombait avant.
 */
function capPerQueue(tickets, queues, rows) {
  if (tickets.length <= rows || queues.length < 2) return tickets.slice(0, rows);

  const piles = new Map(queues.map(q => [q, []]));
  // Une file inconnue (ticket déplacé entre-temps) garde sa propre pile.
  for (const t of tickets) (piles.get(t.queue) ?? piles.set(t.queue, []).get(t.queue)).push(t);

  const out = [];
  for (let i = 0; out.length < rows; i++) {
    const before = out.length;
    for (const pile of piles.values()) {
      if (pile[i] && out.length < rows) out.push(pile[i]);
    }
    if (out.length === before) break;   // toutes les piles sont épuisées
  }
  return out.sort((a, b) => b.priority - a.priority);
}

app.get('/api/rt/priority', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  const min = parseInt(req.query.min, 10);
  const queues = parseQueues(req.query.queue, PRIORITY_QUEUES);
  try {
    const text = await rtPrioritySearch(Number.isNaN(min) ? PRIORITY_MIN : min, queues);
    // parseRTSearch ne remonte pas Priority : on la relit par ticket depuis le bloc brut.
    const priorities = {};
    for (const block of text.split(/\n--\n/)) {
      const id = block.match(/^id:\s*ticket\/(\d+)/m);
      const p  = block.match(/^Priority:\s*(\d+)/m);
      if (id && p) priorities[id[1]] = parseInt(p[1], 10);
    }
    const tickets = parseRTSearch(text)
      .map(t => ({ id: t.id, subject: t.subject, status: t.status, owner: t.owner, queue: t.queue, created: t.created, priority: priorities[t.id] ?? 0 }))
      .sort((a, b) => b.priority - a.priority);
    res.json(capPerQueue(tickets, queues, PRIORITY_ROWS));
  } catch (err) {
    console.error('[rt-priority]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

// ─── RT : tickets ouverts par technicien ─────────────────────────────────────
// UNE seule requête RT pour toute l'équipe, puis regroupement ici. RT 4.0.4 est
// lent (Perl) : sept requêtes, une par technicien, coûteraient sept fois plus
// pour le même résultat.

const OWNER_QUEUES = (process.env.RT_OWNER_QUEUES || PRIORITY_QUEUES.join(','))
  .split(',').map(q => q.trim()).filter(Boolean);
const OWNER_TTL = parseInt(process.env.RT_OWNER_TTL_SEC || '120', 10) * 1000;

// Le cache est indexé par jeu de files : sinon un passage « Siège » → « les deux »
// resservirait la liste de l'autre périmètre pendant deux minutes.
const _ownerCache = new Map();   // 'sos,sos-agences' → { at, data }

async function buildTicketsByOwner(queues) {
  const queueClause = queues.map(q => `Queue = '${q.replace(/'/g, "\\'")}'`).join(' OR ');
  const text = await rtFieldSearch(
    `(${queueClause}) AND (Status = 'new' OR Status = 'open')`,
    'id,Subject,Status,Owner,Queue,Created,Priority',
  );

  const now = Date.now();
  const tickets = parseRTTsv(text).map(t => {
    const created = parseRTDate(t.Created);
    return {
      id: t.id,
      subject: t.Subject || '(sans objet)',
      status: t.Status || '',
      owner: t.Owner || 'Nobody',
      queue: t.Queue || '',
      created: t.Created || null,
      priority: parseInt(t.Priority, 10) || 0,
      // Ancienneté en jours : c'est ce qui saute aux yeux dans une liste, plus
      // qu'une date brute.
      ageDays: created ? Math.floor((now - created.getTime()) / 86400000) : null,
    };
  });

  // Les plus prioritaires d'abord, puis les plus anciens.
  tickets.sort((a, b) => b.priority - a.priority || (b.ageDays ?? 0) - (a.ageDays ?? 0));

  const byOwner = {};
  for (const t of tickets) (byOwner[t.owner] ||= []).push(t);

  return { generatedAt: new Date().toISOString(), queues, total: tickets.length, byOwner };
}

app.get('/api/rt/by-owner', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  const queues = parseQueues(req.query.queue, OWNER_QUEUES);
  const key = queues.join(',');

  const cached = _ownerCache.get(key);
  if (cached && Date.now() - cached.at < OWNER_TTL && !req.query.refresh) {
    return res.json({ ...cached.data, cached: true });
  }
  try {
    const data = await buildTicketsByOwner(queues);
    _ownerCache.set(key, { at: Date.now(), data });
    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[rt-by-owner]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

// ─── RT Stats support (onglet Stats) ─────────────────────────────────────────
// RT 4.0.4 accepte `fields=` sur /search/ticket : la réponse est un TSV, ce qui
// permet de récupérer l'année entière (≈3 000 tickets) en 2 requêtes au lieu
// d'un /show par ticket. Chaque requête coûte ~9 s côté RT (Perl) → cache.

const STATS_QUEUE  = process.env.RT_STATS_QUEUE || 'sos';
const STATS_TTL    = parseInt(process.env.RT_STATS_TTL_MIN || '1440', 10) * 60000;  // 24 h : le cron du matin fait l'actualisation
const _statsCache  = new Map();   // `${queue}:${year}` → { at, data }
const _statsInFlight = new Map(); // même clé → Promise, évite 2 calculs concurrents

// RT choisit lui-même l'ordre des colonnes de `fields` (pas celui demandé) :
// toujours parser via la ligne d'en-tête, jamais par position.
function parseRTTsv(text) {
  if (!/^RT\/[\d.]+ 200/.test(text)) return [];
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const head = lines.findIndex(l => l.startsWith('id\t'));
  if (head === -1) return [];
  const cols = lines[head].split('\t');
  return lines.slice(head + 1)
    .filter(l => /^\d+\t/.test(l))
    .map(l => {
      const cells = l.split('\t');
      return Object.fromEntries(cols.map((c, i) => [c, (cells[i] || '').trim()]));
    });
}

function rtFieldSearch(query, fields) {
  const params = new URLSearchParams({
    user: process.env.RT_USER,
    pass: process.env.RT_PASS,
    query,
    format: 's',
    fields,
  });
  // 60 s : ces requêtes balaient l'année, elles dépassent le timeout par défaut.
  return rtGet(`/REST/1.0/search/ticket?${params}`, 60000);
}

// "2026-08-06 08:52" (heure locale RT). "Not set" / vide → null.
function parseRTDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(nums, q) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
}

async function buildRTStats(queue, year) {
  const from = `${year}-01-01`;
  const to   = `${year + 1}-01-01`;
  const q    = queue.replace(/'/g, "\\'");

  // 2 requêtes séquentielles : RT 4.0.4 encaisse mal le parallélisme sur des
  // recherches aussi larges.
  const closedText = await rtFieldSearch(
    `Queue = '${q}' AND (Status = 'resolved' OR Status = 'rejected') AND Resolved > '${from}' AND Resolved < '${to}'`,
    'id,Owner,Status,Created,Resolved',
  );
  const createdText = await rtFieldSearch(
    `Queue = '${q}' AND Created > '${from}' AND Created < '${to}'`,
    'id,Owner,Status,Created',
  );

  const closed  = parseRTTsv(closedText);
  const created = parseRTTsv(createdText);

  const owners = new Map();   // login → agrégat
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    // created = tout ce qui entre ; rejectedCreated = la part de ces entrées qui
    // a fini rejetée (spam, ticket mal aiguillé). La demande réelle est la
    // différence des deux — c'est elle qui sert de dénominateur à l'absorption.
    created: 0, rejected: 0, rejectedCreated: 0, resolved: 0,
  }));
  const heat    = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const perDay  = new Map();  // 'YYYY-MM-DD' → { total, byOwner }
  const delays  = [];         // heures Created→Resolved, tous techs confondus
  let marathon  = null;       // le ticket resté ouvert le plus longtemps

  const owner = (login) => {
    const key = login || 'Nobody';
    if (!owners.has(key)) {
      owners.set(key, {
        owner: key, resolved: 0, rejected: 0, sameDay: 0,
        months: new Array(12).fill(0), delays: [], bestDay: null,
      });
    }
    return owners.get(key);
  };

  for (const t of closed) {
    const res = parseRTDate(t.Resolved);
    if (!res || res.getFullYear() !== year) continue;
    const o = owner(t.Owner);
    const m = res.getMonth();

    if (t.Status === 'rejected') { o.rejected++; months[m].rejected++; continue; }

    o.resolved++;
    o.months[m]++;
    months[m].resolved++;
    heat[(res.getDay() + 6) % 7][res.getHours()]++;   // lundi = 0

    const day = t.Resolved.slice(0, 10);
    if (!perDay.has(day)) perDay.set(day, { total: 0, byOwner: {} });
    const d = perDay.get(day);
    d.total++;
    d.byOwner[o.owner] = (d.byOwner[o.owner] || 0) + 1;

    const cre = parseRTDate(t.Created);
    if (cre) {
      const hours = (res - cre) / 3600000;
      if (hours >= 0) {
        o.delays.push(hours);
        delays.push(hours);
        if (cre.toDateString() === res.toDateString()) o.sameDay++;
        if (!marathon || hours > marathon.hours) {
          marathon = { id: t.id, owner: o.owner, created: t.Created, resolved: t.Resolved, hours: Math.round(hours) };
        }
      }
    }
  }

  // Les rejets sont comptés ici par mois de *création*, pas de clôture : mélanger
  // les deux cohortes fausserait « créés - rejetés ». La recherche `created`
  // remonte déjà Status, donc ça ne coûte aucune requête RT supplémentaire.
  for (const t of created) {
    const cre = parseRTDate(t.Created);
    if (!cre || cre.getFullYear() !== year) continue;
    const m = months[cre.getMonth()];
    m.created++;
    if (t.Status === 'rejected') m.rejectedCreated++;
  }

  // Meilleure journée de chaque technicien + de l'équipe
  let teamBestDay = null;
  for (const [date, d] of perDay) {
    if (!teamBestDay || d.total > teamBestDay.count) teamBestDay = { date, count: d.total };
    for (const [login, n] of Object.entries(d.byOwner)) {
      const o = owners.get(login);
      if (!o.bestDay || n > o.bestDay.count) o.bestDay = { date, count: n };
    }
  }

  // Mois où chacun a fini n°1 (Nobody exclu : ce n'est pas un technicien)
  const crowns = {};
  months.forEach((_, i) => {
    let top = null;
    for (const o of owners.values()) {
      if (o.owner === 'Nobody') continue;
      if (o.months[i] > 0 && (!top || o.months[i] > top.n)) top = { login: o.owner, n: o.months[i] };
    }
    if (top) crowns[top.login] = (crowns[top.login] || 0) + 1;
  });

  const totalResolved = [...owners.values()].reduce((s, o) => s + o.resolved, 0);

  // « Nobody » n'est pas un technicien : ses résolutions sortent du dénominateur
  // des parts. Les y laisser diluait la part de tout le monde (157 tickets non
  // assignés en 2026, soit 6 % retirés à chacun). Sa propre part vaut null —
  // « part de rien » n'a pas de sens, l'affichage met un tiret.
  const assignedResolved = [...owners.values()]
    .reduce((s, o) => (o.owner === 'Nobody' ? s : s + o.resolved), 0);

  const ownerList = [...owners.values()]
    .map(o => ({
      owner:       o.owner,
      resolved:    o.resolved,
      rejected:    o.rejected,
      share:       o.owner === 'Nobody' || !assignedResolved ? null : o.resolved / assignedResolved,
      months:      o.months,
      medianHours: median(o.delays),
      p90Hours:    quantile(o.delays, 0.9),
      sameDayPct:  o.resolved ? o.sameDay / o.resolved : 0,
      bestDay:     o.bestDay,
      crowns:      crowns[o.owner] || 0,
    }))
    .sort((a, b) => b.resolved - a.resolved);

  // Jours ouvrés écoulés dans l'année (pour la cadence)
  const start   = new Date(year, 0, 1);
  const end     = new Date(Math.min(Date.now(), new Date(year + 1, 0, 1).getTime()));
  let workdays  = 0;
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) workdays++;
  }

  const backlog = created.filter(t => t.Status === 'new' || t.Status === 'open');

  return {
    year,
    queue,
    generatedAt: new Date().toISOString(),
    totals: {
      resolved:   totalResolved,
      rejected:   [...owners.values()].reduce((s, o) => s + o.rejected, 0),
      created:    months.reduce((s, m) => s + m.created, 0),
      rejectedCreated: months.reduce((s, m) => s + m.rejectedCreated, 0),
      openFromYear: backlog.length,
      unassigned: owners.get('Nobody')?.resolved || 0,
      perWorkday: workdays ? totalResolved / workdays : 0,
      workdays,
    },
    team: {
      medianHours: median(delays),
      p90Hours:    quantile(delays, 0.9),
      sameDayPct:  totalResolved ? [...owners.values()].reduce((s, o) => s + o.sameDay, 0) / totalResolved : 0,
      bestDay:     teamBestDay,
      marathon,
    },
    owners: ownerList,
    months,
    heat,
  };
}

app.get('/api/rt/stats', async (req, res) => {
  if (!process.env.RT_USER || !process.env.RT_PASS) {
    return res.status(503).json({ error: 'RT_USER / RT_PASS non configurés' });
  }
  const queue = String(req.query.queue || STATS_QUEUE);
  const year  = parseInt(req.query.year, 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) return res.status(400).json({ error: 'Année invalide' });

  const key    = `${queue}:${year}`;
  const force  = req.query.refresh === '1';
  const cached = _statsCache.get(key);
  const fresh  = cached && Date.now() - cached.at < STATS_TTL;

  // Cache expiré mais données présentes : on sert le périmé immédiatement et on
  // recalcule en fond — 18 s d'attente RT, ça ne se met pas sur le chemin critique.
  // Le bouton « Actualiser » (refresh=1), lui, attend le vrai recalcul.
  if (cached && !force) {
    if (!fresh) refreshRTStats(key, queue, year).catch(() => {});
    return res.json({ ...cached.data, cachedAt: new Date(cached.at).toISOString(), stale: !fresh });
  }

  try {
    const data = await refreshRTStats(key, queue, year);
    res.json({ ...data, cachedAt: data.generatedAt, stale: false });
  } catch (err) {
    console.error('[rt-stats]', err.message);
    res.status(500).json({ error: 'Erreur connexion RT' });
  }
});

function refreshRTStats(key, queue, year) {
  if (_statsInFlight.has(key)) return _statsInFlight.get(key);
  const p = buildRTStats(queue, year)
    .then((data) => { _statsCache.set(key, { at: Date.now(), data }); return data; })
    .finally(() => _statsInFlight.delete(key));
  _statsInFlight.set(key, p);
  return p;
}

// Actualisation quotidienne : le cache est reconstruit tous les matins avant
// l'arrivée de l'équipe, pour que personne ne tombe sur les ~18 s de calcul RT.
// Avec un TTL de 24 h, c'est ce cron qui rythme les données de la journée.
const STATS_CRON = process.env.RT_STATS_CRON || '0 8 * * *';
const STATS_TZ   = process.env.RT_STATS_TZ   || 'Europe/Paris';

if (cron.validate(STATS_CRON)) {
  cron.schedule(STATS_CRON, async () => {
    if (!process.env.RT_USER || !process.env.RT_PASS) return;
    const year = new Date().getFullYear();
    for (const queue of STATS_QUEUE.split(',').map(q => q.trim()).filter(Boolean)) {
      try {
        const started = Date.now();
        const data = await refreshRTStats(`${queue}:${year}`, queue, year);
        console.log(`[rt-stats-cron] ${queue} ${year} — ${data.totals.resolved} résolus en ${Date.now() - started} ms`);
      } catch (err) {
        // Le cache précédent reste servi : une panne RT ne vide jamais la page.
        console.error(`[rt-stats-cron] ${queue} ${year} —`, err.message);
      }
    }
  }, { timezone: STATS_TZ });
  console.log(`[rt-stats] actualisation planifiée « ${STATS_CRON} » (${STATS_TZ})`);
} else {
  console.error(`[rt-stats] RT_STATS_CRON invalide : « ${STATS_CRON} » — actualisation automatique désactivée`);
}

// ─── RT Arrivées (créations de compte / nouveaux collaborateurs) ──────────────
// Les mails RH « [LDAP][RH] Creation de compte: … » créent un ticket dans la
// file « Arrivées … ». Le corps du mail contient des champs structurés qu'on
// reparse pour alimenter l'onglet Arrivées.

function rtGet(pathWithQuery, timeoutMs = 15000) {
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
    // RT 4.0.4 (Perl) peut être lent : on coupe à 15 s plutôt que d'empiler les connexions.
    req.setTimeout(timeoutMs, () => req.destroy(new Error('RT timeout')));
    req.end();
  });
}

// Exécute fn sur items avec au plus `limit` appels simultanés — évite de noyer
// RT sous des dizaines de requêtes d'historique en parallèle.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Ne recherche que les arrivées récentes (fenêtre glissante) pour garder la
// requête RT légère ; tout est surchargeable par variables d'env.
function buildArriveeQuery() {
  if (process.env.RT_ARRIVEE_QUERY) return process.env.RT_ARRIVEE_QUERY;
  const days = parseInt(process.env.RT_ARRIVEE_DAYS || '120', 10);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return `Subject LIKE 'Creation de compte' AND Created > '${cutoff}' AND Status != 'deleted'`;
}

function rtArriveeSearch() {
  const params = new URLSearchParams({
    user: process.env.RT_USER,
    pass: process.env.RT_PASS,
    query: buildArriveeQuery(),
    orderby: '-Created',
    rows: process.env.RT_ARRIVEE_ROWS || '30',
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
    // Historiques récupérés 3 par 3 pour ne pas saturer RT.
    const arrivals = await mapLimit(tickets, 3, async (t) => {
      let body = {};
      try { body = parseArriveeBody(await rtTicketHistory(t.id)); }
      catch (e) { console.error(`[rt-arrivees] history ${t.id}:`, e.message); }
      return { ...t, ...body, responsableEmail: extractResponsableEmail(t.cc) };
    });
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
// Écoute UNIQUEMENT sur la boucle locale : Nginx est le seul point d'entrée.
// Sans cela, on joint l'API directement depuis le réseau en contournant
// l'authentification — et surtout on peut forger l'en-tête Remote-User
// qu'Authelia est censé être seul à produire.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] Serveur email démarré sur le port ${PORT}`);
});
