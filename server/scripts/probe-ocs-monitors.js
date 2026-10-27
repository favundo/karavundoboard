#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE : les écrans des machines d'un utilisateur, d'après OCS.
 *
 * CHEMIN : uid → /computers/search?USERID= (vérifié par probe-ocs-user.js) →
 * /computer/{id} → section `monitors`, remontée par l'agent depuis l'EDID.
 *
 * CE QUE CETTE PASSE TRANCHE :
 *   1. Le détail /computer/{id} contient-il la section monitors, ou faut-il
 *      l'endpoint de section /computer/{id}/monitors ?
 *   2. Quels champs sont remplis (MANUFACTURER, CAPTION, SERIAL, TYPE…), et le
 *      numéro de série est-il exploitable ? L'EDID en rend souvent un factice
 *      (« 0 », « 01010101 ») sur les écrans d'entrée de gamme.
 *
 * CE QUE LA RÉPONSE VAUT : les écrans BRANCHÉS à la machine au dernier
 * inventaire, pas ceux « possédés » par la personne. Un portable docké sur un
 * poste partagé remonte l'écran du bureau ; un portable inventorié hors dock,
 * aucun.
 *
 * Il n'écrit rien et peut tourner en prod sans risque.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-ocs-monitors.js dlelong
 */
require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = process.env.OCS_URL || 'http://gestion-desktop.in.karavel.com';
const UID = (process.argv[2] || '').trim();

if (!UID) { console.error('Usage : node scripts/probe-ocs-monitors.js <uid>'); process.exit(1); }
if (!process.env.OCS_USER || !process.env.OCS_PASS) {
  console.error('OCS_USER / OCS_PASS absents du .env — rien à sonder.');
  process.exit(1);
}

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
        catch { resolve({ status: res.statusCode, data: null, raw: data.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** OCS 2.x rend tantôt un tableau, tantôt un objet indexé par ID. */
const entries = (data) => {
  if (!data || typeof data !== 'object') return [];
  return Array.isArray(data) ? data : Object.values(data);
};

/** « KARAVEL\\dlelong », « dlelong@in.karavel.com » → « dlelong ». */
const shortUser = (v) => String(v ?? '').trim().split(/[\\/]/).pop().split('@')[0].toLowerCase();

/** Numéros de série que l'EDID rend quand l'écran n'en publie pas. */
const FAKE_SERIAL = /^(0+|1+|01010101|00000001|12345678|)$/i;

const printMonitors = (list) => {
  if (!list.length) { console.log('      (aucun écran remonté)'); return; }
  for (const m of list) {
    const serial = String(m.SERIAL ?? '').trim();
    console.log(`      • ${m.MANUFACTURER ?? '?'} — ${m.CAPTION ?? m.DESCRIPTION ?? '?'}` +
                `  type=${m.TYPE ?? '—'}  série=${serial || '—'}${FAKE_SERIAL.test(serial) ? ' (factice)' : ''}`);
  }
  console.log(`      champs : ${Object.keys(list[0]).join(', ')}`);
};

(async () => {
  console.log(`\n══ Écrans de « ${UID} » d'après OCS\n`);

  let ids = [];
  for (const value of [UID, UID.toUpperCase()]) {
    const qs = new URLSearchParams({ start: '0', limit: '20', USERID: value });
    const r = await ocsFetch(`/ocsapi/v1/computers/search?${qs}`);
    ids = entries(r.data).map(x => x?.ID).filter(v => v != null);
    console.log(`── search USERID=${value} → HTTP ${r.status}, ${ids.length} id(s)`);
    if (ids.length) break;
  }
  if (!ids.length) { console.log('   aucune machine : uid absent d\'OCS, ou session jamais relevée.\n'); return; }

  for (const id of ids.slice(0, 10)) {
    const d = await ocsFetch(`/ocsapi/v1/computer/${id}`);
    const e = entries(d.data)[0];
    const h = e?.hardware ?? {};
    // LIKE côté OCS : « dlelong » ramènerait « dlelong2 ».
    if (shortUser(h.USERID) !== shortUser(UID)) {
      console.log(`\n── ${h.NAME ?? id} ignorée (USERID ${JSON.stringify(h.USERID)})`);
      continue;
    }
    console.log(`\n── ${h.NAME ?? '?'} (id ${id}), inventorié le ${h.LASTDATE ?? h.LASTCOME ?? '?'}`);
    console.log(`   sections du détail : ${e ? Object.keys(e).join(', ') : '—'}`);

    const inline = Array.isArray(e?.monitors) ? e.monitors : null;
    console.log(`   1. section monitors dans /computer/${id} : ${inline ? `${inline.length} écran(s)` : 'absente'}`);
    if (inline) printMonitors(inline);

    const s = await ocsFetch(`/ocsapi/v1/computer/${id}/monitors`);
    const sect = entries(s.data).flatMap(x => (Array.isArray(x?.monitors) ? x.monitors : x?.MANUFACTURER !== undefined ? [x] : []));
    console.log(`   2. /computer/${id}/monitors → HTTP ${s.status}, ${sect.length} écran(s)${s.raw ? ` — ${s.raw}` : ''}`);
    if (sect.length && !inline) printMonitors(sect);
  }
  console.log('\n   Rappel : écrans branchés AU DERNIER INVENTAIRE, pas écrans attribués à la personne.\n');
})().catch(err => { console.error(err.message); process.exit(1); });
