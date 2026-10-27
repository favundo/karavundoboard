#!/usr/bin/env node
/**
 * Export CSV des écrans d'une liste d'utilisateurs, d'après OCS. LECTURE SEULE.
 *
 * Une ligne par écran externe : uid ; machine ; écran ; dernier inventaire.
 * Un uid absent d'OCS, ou une machine sans écran externe, a quand même sa
 * ligne — un oubli dans l'export ne doit pas passer pour « pas d'écran ».
 *
 * Mêmes règles que la recherche du support (lib/ocsMonitors.js) : dalle des
 * portables filtrée, correspondance exacte sur l'uid. Ce sont les écrans
 * branchés AU DERNIER INVENTAIRE : un portable inventorié hors dock n'en a pas.
 *
 * Usage (sur le serveur, qui a les identifiants OCS) :
 *   cd /opt/karavundoboard/server
 *   node scripts/export-ocs-monitors.js uids.txt > ecrans.csv
 *   node scripts/export-ocs-monitors.js mrolland ext-favundo > ecrans.csv
 * uids.txt : un uid par ligne (virgules, points-virgules et espaces acceptés ;
 * une adresse mail est réduite à son uid, un en-tête « uid » est ignoré).
 */
require('dotenv').config();
const fs = require('fs');
const http = require('http');
const https = require('https');
const { parseMonitors } = require('../lib/ocsMonitors');

const BASE = process.env.OCS_URL || 'http://gestion-desktop.in.karavel.com';

if (!process.env.OCS_USER || !process.env.OCS_PASS) {
  console.error('OCS_USER / OCS_PASS absents du .env — rien à exporter.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage : node scripts/export-ocs-monitors.js <fichier_uids | uid…> > ecrans.csv');
  process.exit(1);
}
const raw = args.length === 1 && fs.existsSync(args[0]) ? fs.readFileSync(args[0], 'utf8') : args.join(' ');

function ocsFetch(path) {
  const auth = Buffer.from(`${process.env.OCS_USER}:${process.env.OCS_PASS}`).toString('base64');
  const url = new URL(path, BASE);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const entries = (data) => {
  if (!data || typeof data !== 'object') return [];
  return Array.isArray(data) ? data : Object.values(data);
};
const shortUser = (v) => String(v ?? '').trim().split(/[\\/]/).pop().split('@')[0].toLowerCase();
// Une liste tirée d'un annuaire mêle souvent uid et adresses : « jdupont@karavel.com » → « jdupont ».
const UIDS = [...new Set(raw.split(/[\s,;]+/).map(shortUser).filter(u => u && u !== 'uid'))];

/** « 2026-10-27 15:42:41 » → « 27/10/2026 », lisible et triable dans Excel FR. */
const frDate = (s) => {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

// Point-virgule : séparateur attendu par Excel en paramètres régionaux français.
const cell = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function machinesOf(uid) {
  let ids = [];
  for (const value of [uid, uid.toUpperCase()]) {
    const qs = new URLSearchParams({ start: '0', limit: '20', USERID: value });
    const r = await ocsFetch(`/ocsapi/v1/computers/search?${qs}`);
    if (r.status !== 200) throw new Error(`recherche OCS : HTTP ${r.status}`);
    ids = entries(r.data).map(x => x?.ID).filter(v => v != null);
    if (ids.length) break;
  }
  const machines = [];
  for (const id of ids.slice(0, 10)) {
    const d = await ocsFetch(`/ocsapi/v1/computer/${id}`);
    const e = entries(d.data)[0];
    const hw = e?.hardware ?? {};
    // LIKE côté OCS : « dlelong » ramènerait « dlelong2 ».
    if (shortUser(hw.USERID) !== uid) continue;
    machines.push({ name: hw.NAME ?? `id ${id}`, date: hw.LASTDATE ?? hw.LASTCOME ?? '', ...parseMonitors(e.monitors) });
  }
  // La plus récemment inventoriée d'abord.
  return machines.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

(async () => {
  const rows = [['uid', 'machine', 'écran', 'dernier inventaire']];
  let screens = 0;
  for (const [i, uid] of UIDS.entries()) {
    process.stderr.write(`[${i + 1}/${UIDS.length}] ${uid}… `);
    let machines;
    try {
      machines = await machinesOf(uid);
    } catch (err) {
      // Une panne OCS ne doit pas produire un fichier qui a l'air complet.
      console.error(`\n${err.message} — export interrompu`);
      process.exit(1);
    }
    if (!machines.length) {
      rows.push([uid, '', 'absent d\'OCS', '']);
      process.stderr.write('absent d\'OCS\n');
      continue;
    }
    for (const m of machines) {
      if (!m.external.length) {
        rows.push([uid, m.name, m.builtIn ? 'aucun écran externe (portable hors dock ?)' : 'aucun écran externe', frDate(m.date)]);
        continue;
      }
      for (const s of m.external) {
        rows.push([uid, m.name, [s.model, s.manufacturer, `S/N ${s.serial ?? 'non publié'}`].filter(Boolean).join(' · '), frDate(m.date)]);
        screens++;
      }
    }
    process.stderr.write(`${machines.length} machine(s)\n`);
  }
  // BOM : sans lui, Excel lit l'UTF-8 comme du Latin-1 et casse les accents.
  process.stdout.write('﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n');
  console.error(`\n${UIDS.length} uid(s), ${screens} écran(s) externe(s) exporté(s).`);
})().catch(err => { console.error(err.message); process.exit(1); });
