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

function esetFetch(path) {
  return new Promise((resolve, reject) => {
    const base = process.env.ESET_URL || 'https://antivirus03.in.karavel.com';
    const url = new URL(path, base);
    const credentials = Buffer.from(`${process.env.ESET_USER}:${process.env.ESET_PASS}`).toString('base64');
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        console.log(`[eset] HTTP ${res.statusCode} ${url.pathname}${url.search}`);
        console.log(`[eset] raw text: ${data.slice(0, 300)}`);
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const ESET_STATUS = {
  1: { label: 'Protégé',        color: 'green'  },
  2: { label: 'Avertissement',  color: 'yellow' },
  3: { label: 'Non protégé',    color: 'red'    },
};

// endpoint debug temporaire — à supprimer après validation
app.get('/api/eset/debug', async (req, res) => {
  if (!process.env.ESET_USER || !process.env.ESET_PASS) {
    return res.status(503).json({ error: 'ESET_USER / ESET_PASS non configurés' });
  }
  try {
    const data = await esetFetch('/era/v1/computers?pageSize=2');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/eset/computer', async (req, res) => {
  const { dns, sn } = req.query;
  if (!dns && !sn) return res.status(400).json({ error: 'Paramètre dns ou sn requis' });
  if (!process.env.ESET_USER || !process.env.ESET_PASS) {
    return res.status(503).json({ error: 'ESET_USER / ESET_PASS non configurés' });
  }
  try {
    const param = dns
      ? `filter.computerName=${encodeURIComponent(dns)}`
      : `filter.serialNumber=${encodeURIComponent(sn)}`;
    const data = await esetFetch(`/era/v1/computers?${param}&pageSize=1`);
    console.log('[eset] raw response:', JSON.stringify(data));
    const computers = data?.computers ?? data?.data ?? [];
    if (!computers.length) return res.status(404).json({ error: 'Ordinateur non trouvé dans ESET' });

    const c = computers[0];
    const ip = c.networkAddresses?.[0]?.address
            ?? c.ipAddresses?.[0]
            ?? null;
    const status = c.protectionStatus ?? c.managedProductStatuses?.[0]?.status ?? null;
    const threats = c.threats?.unresolved ?? c.threatsDetected ?? c.numberOfThreats ?? 0;
    const esatUrl = process.env.ESET_URL || 'https://antivirus03.in.karavel.com';

    res.json({
      uuid:             c.uuid,
      name:             c.name,
      ip,
      protectionStatus: status,
      statusLabel:      ESET_STATUS[status]?.label ?? String(status ?? '?'),
      statusColor:      ESET_STATUS[status]?.color ?? 'gray',
      threats,
      antivirusVersion: c.antivirusVersion ?? c.securityProductVersion ?? null,
      lastConnectedTime: c.lastConnectedTime ?? c.lastSeen ?? null,
      operatingSystem:  c.operatingSystem?.description ?? c.osDescription ?? null,
      loggedInUsers:    Array.isArray(c.loggedInUsers)
                          ? c.loggedInUsers.join(', ')
                          : (c.lastLoggedUser ?? null),
      consoleUrl: `${esatUrl}/protect/computers/detail/${c.uuid}`,
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
    const url = new URL(`/REST/1.0/ticket/${ticketId}/show`, base);
    const credentials = Buffer.from(`${process.env.RT_USER}:${process.env.RT_PASS}`).toString('base64');
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      headers: { Authorization: `Basic ${credentials}` },
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
