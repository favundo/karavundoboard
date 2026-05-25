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
  const body = JSON.stringify({ name: process.env.ESET_USER, password: process.env.ESET_PASS });
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
        console.log(`[eset] GetTokens HTTP ${res.statusCode}`);
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
        console.log(`[eset] HTTP ${res.statusCode} ${url.pathname}${url.search}`);
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
  const { data: groupsData } = await esetFetch('/v1/device_groups');
  const groups = groupsData?.groups ?? groupsData?.deviceGroups ?? groupsData?.items ?? [];
  const allDevices = [];
  for (const group of groups) {
    const uuid = group.uuid ?? group.groupUuid ?? group.id;
    if (!uuid) continue;
    const { data: devData } = await esetFetch(`/v1/device_groups/${uuid}/devices`);
    const devices = devData?.devices ?? devData?.items ?? [];
    allDevices.push(...devices);
  }
  _esetDeviceCache = allDevices;
  _esetDeviceCacheExpiry = Date.now() + 5 * 60 * 1000;
  return allDevices;
}

const ESET_STATUS = {
  1: { label: 'Protégé',        color: 'green'  },
  2: { label: 'Avertissement',  color: 'yellow' },
  3: { label: 'Non protégé',    color: 'red'    },
};

// endpoint debug — à supprimer après validation des champs
app.get('/api/eset/debug', async (req, res) => {
  if (!process.env.ESET_USER || !process.env.ESET_PASS) {
    return res.status(503).json({ error: 'ESET_USER / ESET_PASS non configurés' });
  }
  try {
    const groups = await esetFetch('/v1/device_groups');
    const firstGroupUuid = (groups.data?.groups ?? groups.data?.items ?? [])[0]?.uuid;
    const devices = firstGroupUuid
      ? await esetFetch(`/v1/device_groups/${firstGroupUuid}/devices`)
      : null;
    res.json({ groups: groups.data, sample_devices: devices?.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/eset/computer', async (req, res) => {
  const { dns } = req.query;
  if (!dns) return res.status(400).json({ error: 'Paramètre dns requis' });
  if (!process.env.ESET_USER || !process.env.ESET_PASS) {
    return res.status(503).json({ error: 'ESET_USER / ESET_PASS non configurés' });
  }
  try {
    const devices = await esetGetAllDevices();
    const shortName = dns.split('.')[0].toLowerCase();
    const c = devices.find(d => {
      const n = (d.name ?? d.hostname ?? d.computerName ?? '').toLowerCase();
      return n === dns.toLowerCase() || n === shortName || n.startsWith(shortName + '.');
    });
    if (!c) return res.status(404).json({ error: 'Ordinateur non trouvé dans ESET' });

    const ip = c.networkAddresses?.[0]?.address ?? c.ipAddress ?? c.ipAddresses?.[0] ?? null;
    const status = c.protectionStatus ?? c.managedProductStatuses?.[0]?.status ?? null;
    const threats = c.threats?.unresolved ?? c.threatsDetected ?? c.numberOfThreats ?? 0;
    const esetUrl = process.env.ESET_URL || 'https://antivirus03.in.karavel.com:9443';

    res.json({
      uuid:              c.uuid,
      name:              c.name ?? c.hostname ?? c.computerName,
      ip,
      protectionStatus:  status,
      statusLabel:       ESET_STATUS[status]?.label ?? String(status ?? '?'),
      statusColor:       ESET_STATUS[status]?.color ?? 'gray',
      threats,
      antivirusVersion:  c.antivirusVersion ?? c.securityProductVersion ?? null,
      lastConnectedTime: c.lastConnectedTime ?? c.lastSeen ?? null,
      operatingSystem:   c.operatingSystem?.description ?? c.osDescription ?? null,
      loggedInUsers:     Array.isArray(c.loggedInUsers)
                           ? c.loggedInUsers.join(', ')
                           : (c.lastLoggedUser ?? null),
      consoleUrl: `${esetUrl}/protect/computers/detail/${c.uuid}`,
    });
  } catch (err) {
    console.error('[eset]', err.message);
    res.status(500).json({ error: 'Erreur connexion ESET' });
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
  zkarroum:      { label: 'Z. Karroum',      email: 'zkarroum@karavel.com' },
  maabid:        { label: 'M. Abid',          email: 'maabid@karavel.com' },
  cananthakumar: { label: 'C. Ananthakumar', email: 'cananthakumar@karavel.com' },
  rrinville:     { label: 'R. Rinville',     email: 'rrinville@karavel.com' },
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
app.post('/send-email', async (req, res) => {
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
