#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE de l'historique des états des agents Axialys : pauses
 * (« retraits »), connexions, appels.
 *
 * POURQUOI : on veut savoir combien de temps les agents du support passent en
 * pause, et pour quel motif. La doc (guide.axialys.com, API Voice Management)
 * annonce POST /vm/calls/status → id_op, duration, date, id_call, infos, type
 * (call_in, call_out, break, login, catchup). Mais l'API a déjà contredit sa
 * doc trois fois (auth, noms des paramètres, fenêtre de période), et
 * /vm/operators répond 401 avec notre token. Rien n'est acquis avant d'avoir vu
 * la réponse.
 *
 * Questions auxquelles ce script répond :
 *   1. Le token a-t-il le droit d'appeler /vm/calls/status ?
 *   2. Quels types rend-il vraiment, et que contient `infos` sur une pause
 *      (le motif ? un id de motif ? rien ?)
 *   3. La période demandée est-elle respectée, ou retombe-t-on sur « le jour
 *      courant depuis minuit » comme pour les appels ?
 *   4. Combien de temps de pause par agent du support, par motif, aujourd'hui ?
 *   5. /vm/operators_init (état courant, motif de pause en cours) répond-il ?
 *
 * Les id_op des agents du support sont lus dans axialys_calls, faute
 * d'annuaire : les lignes ingérées par l'API portent id_op et op_name.
 *
 * Il n'écrit rien, et peut tourner en prod sans risque.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-axialys-status.js
 *   cd /opt/karavundoboard/server && node scripts/probe-axialys-status.js 2026-10-02
 */

require('dotenv').config();
const https = require('https');
const http  = require('http');
const { createClient } = require('@supabase/supabase-js');

const AX_BASE  = process.env.AXIALYS_URL   || 'https://api.axialys.com';
const AX_TOKEN = process.env.AXIALYS_TOKEN;
const AX_TZ    = process.env.AXIALYS_TZ    || 'Europe/Paris';

if (!AX_TOKEN) {
  console.error('AXIALYS_TOKEN absent — rien à sonder.');
  process.exit(1);
}

/** Rend { status, body } sans jamais rejeter sur un code HTTP : on veut le voir. */
function axialys(method, path, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const url  = new URL(path, AX_BASE);
    const lib  = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method,
      headers: {
        Authorization: `APIKey ${AX_TOKEN}`,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* on rend le brut */ }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('timeout Axialys')));
    if (body) req.write(body);
    req.end();
  });
}

const rowsOf = (json) => (Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []));
const dayOf  = new Intl.DateTimeFormat('en-CA', { timeZone: AX_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDur = (s) => `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`;

/**
 * /vm/calls/status réclame `date` / `date_end` d'après la doc ; les appels, eux,
 * exigeaient `dt` / `dt_end`. On essaie dans cet ordre et on garde la première
 * variante acceptée, en disant laquelle.
 */
async function fetchStatus(from, to) {
  const variants = [
    { date: from, date_end: to },
    { date: from, date_end: to, dt: from, dt_end: to },
  ];
  for (const payload of variants) {
    const r = await axialys('POST', '/vm/calls/status', payload);
    console.log(`  POST /vm/calls/status ${JSON.stringify(payload)} → HTTP ${r.status}`
      + (r.status !== 200 ? ` — ${r.raw.slice(0, 200)}` : ''));
    if (r.status === 200) return rowsOf(r.json);
  }
  return null;
}

function summarize(rows, label) {
  const days  = rows.map(r => r.date).filter(Boolean).map(d => dayOf.format(new Date(d))).sort();
  const types = {};
  for (const r of rows) types[r.type] = (types[r.type] || 0) + 1;
  console.log(`  ${label} : ${rows.length} lignes, jours rendus ${days[0] || '—'} → ${days[days.length - 1] || '—'}`);
  console.log(`  types : ${JSON.stringify(types)}`);
  console.log(`  agents distincts (id_op) : ${new Set(rows.map(r => r.id_op)).size}`);
}

(async () => {
  const today = dayOf.format(new Date());
  const past  = process.argv[2] || dayOf.format(new Date(Date.now() - 3 * 86400000));

  // ── Agents du support, depuis nos propres données ──
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const { data: agentRows, error } = await supabase
    .from('axialys_calls')
    .select('id_op,op_name')
    .not('id_op', 'is', null)
    .order('call_date', { ascending: false })
    .limit(1000);
  if (error) console.error('axialys_calls :', error.message);
  const support = new Map();   // id_op → nom
  for (const r of agentRows || []) if (r.op_name && !support.has(r.id_op)) support.set(r.id_op, r.op_name);
  console.log(`\n▶ Agents du support connus dans axialys_calls : `
    + `${[...support].map(([id, n]) => `${n} (#${id})`).join(', ') || 'aucun'}`);

  // ── 1-2. Aujourd'hui ──
  console.log(`\n▶ Historique des états, aujourd'hui (${today})`);
  const rows = await fetchStatus(today, today);
  if (!rows) {
    console.log('\n✗ /vm/calls/status refusé — le token n\'a pas ce périmètre. Voir avec Axialys.');
  } else {
    summarize(rows, 'aujourd\'hui');

    const mine = rows.filter(r => support.has(Number(r.id_op)));
    console.log(`  dont agents du support : ${mine.length} lignes`);

    // Échantillons bruts : la forme de `infos` est la vraie inconnue.
    const seen = new Set();
    console.log('\n  Échantillon brut, une ligne par type (agents du support d\'abord) :');
    for (const r of [...mine, ...rows]) {
      if (seen.has(r.type)) continue;
      seen.add(r.type);
      console.log(`    ${JSON.stringify(r)}`);
    }
    const breaks = (mine.length ? mine : rows).filter(r => r.type === 'break').slice(0, 5);
    if (breaks.length) {
      console.log('\n  Cinq pauses brutes :');
      for (const r of breaks) console.log(`    ${JSON.stringify(r)}`);
    }

    // ── 4. Temps de pause par agent et par motif ──
    if (mine.length) {
      console.log('\n▶ Pauses des agents du support, par motif (`infos`)');
      const by = new Map();
      for (const r of mine.filter(x => x.type === 'break')) {
        const k = `${support.get(Number(r.id_op))} | ${typeof r.infos === 'object' ? JSON.stringify(r.infos) : r.infos}`;
        const v = by.get(k) || { n: 0, sec: 0 };
        v.n++; v.sec += Number(r.duration) || 0;
        by.set(k, v);
      }
      for (const [k, v] of [...by].sort((a, b) => b[1].sec - a[1].sec)) {
        console.log(`    ${k} : ${v.n} pause(s), ${fmtDur(v.sec)}`);
      }
      if (!by.size) console.log('    aucune pause aujourd\'hui');
    }
  }

  // ── 3. Une période passée : historique rejouable ou jour courant seulement ? ──
  console.log(`\n▶ Période passée demandée : ${past} → ${past}`);
  const old = await fetchStatus(past, past);
  if (old) {
    summarize(old, 'passé');
    const days = new Set(old.map(r => r.date).filter(Boolean).map(d => dayOf.format(new Date(d))));
    console.log(days.has(past)
      ? `  ✓ la période est respectée : l'historique des pauses est REJOUABLE.`
      : `  ✗ ${past} absent de la réponse : comme pour les appels, il faudra capturer au fil de la journée.`);
  }

  // ── 5. État courant ──
  console.log('\n▶ État courant : GET /vm/operators_init (limité à un appel toutes les 30 s)');
  const cur = await axialys('GET', '/vm/operators_init');
  console.log(`  HTTP ${cur.status}${cur.status !== 200 ? ` — ${cur.raw.slice(0, 200)}` : ''}`);
  if (cur.status === 200) {
    const ops = rowsOf(cur.json);
    const ours = ops.filter(o => support.has(Number(o.id)));
    console.log(`  ${ops.length} opérateurs, dont ${ours.length} du support`);
    for (const o of (ours.length ? ours : ops).slice(0, 5)) console.log(`    ${JSON.stringify(o)}`);
  }
})().catch((err) => {
  console.error('Échec de la sonde :', err.message);
  process.exit(1);
});
