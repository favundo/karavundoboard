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

/** Lendemain d'une date « YYYY-MM-DD ». */
const nextDay = (d) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

/**
 * Premier passage (05/10/2026) : `date`/`date_end` seuls ET `dt`/`dt_end` égaux
 * au même jour rendent tous deux 400 « check: dt,dt_end ». Le message ne dit
 * donc pas « manquant » mais « invalide ». Or l'ingestion des appels, qui
 * marche, envoie dt = J et dt_end = J+1 : deux dates différentes. On essaie
 * cette forme d'abord, puis des dates-heures, et on garde la première acceptée
 * en disant laquelle.
 *
 * Un 400 n'est PAS un refus de droits : le token est accepté, c'est la forme
 * qui pèche. Seuls 401 / 403 disent « hors périmètre ».
 */
async function fetchStatus(from, to) {
  const end = nextDay(to);
  // Sondé le 05/10/2026 : seule la dernière forme passe — l'API valide `dt`
  // ET `date`, et respecte alors la période (le 02/10 rendu le 05/10). Les
  // autres restent pour le cas où Axialys changerait encore d'avis.
  const variants = [
    { dt: from, dt_end: end, date: from, date_end: end },
    { dt: from, dt_end: end },
    { dt: `${from} 00:00:00`, dt_end: `${to} 23:59:59` },
  ];
  let lastStatus = null;
  for (const payload of variants) {
    const r = await axialys('POST', '/vm/calls/status', payload);
    lastStatus = r.status;
    console.log(`  POST /vm/calls/status ${JSON.stringify(payload)} → HTTP ${r.status}`
      + (r.status !== 200 ? ` — ${r.raw.slice(0, 200)}` : ''));
    if (r.status === 200) return { rows: rowsOf(r.json) };
    if (r.status === 401 || r.status === 403) break;   // inutile d'insister
  }
  return { rows: null, status: lastStatus };
}

function summarize(rows, label) {
  const days  = rows.map(r => r.date).filter(Boolean).map(d => dayOf.format(new Date(d))).sort();
  const types = {};
  for (const r of rows) types[r.type] = (types[r.type] || 0) + 1;
  console.log(`  ${label} : ${rows.length} lignes, jours rendus ${days[0] || '—'} → ${days[days.length - 1] || '—'}`);
  console.log(`  types : ${JSON.stringify(types)}`);
  console.log(`  agents distincts (id_op) : ${new Set(rows.map(r => r.id_op)).size}`);
}

/**
 * Libellés des motifs de pause, relevés dans le portail (configuration des
 * pauses) le 05/10/2026. La numérotation part de ZÉRO : `userN` = « Pause N+1 »
 * du portail — vérifié le 05/10/2026, un agent mis volontairement en Pause Dej
 * (Pause 7) est sorti en `user6`. `user15` n'a pas de ligne dans le portail (il
 * s'arrête à Pause 15) : c'est le statut de connexion « Indisponible », posé
 * quelques secondes à chaque connexion mais aussi choisi à la main (51 min
 * relevées). Liste commune à tout le compte Karavel.
 */
const PAUSE_LABELS = {
  user0: 'Appel interne', user1: 'Coaching', user2: 'Formation', user3: 'Heure sup',
  user4: 'Panne', user5: 'Pause', user6: 'Pause Dej', user7: 'Pause T',
  user8: 'Relance', user9: 'Reunion', user10: 'Post Appel', user11: 'Appel WebRTC',
  user12: 'Blocage Sup', user13: 'Nouveau Vendeur', user14: 'Admin Fram Signature',
  user15: 'Indisponible',
};
const pauseLabel = (k) => (PAUSE_LABELS[k] ? `${k} ${PAUSE_LABELS[k]}` : k);

/**
 * Par agent du support : temps connecté, pauses par motif, post-appel.
 */
function agentBreakdown(rows, support, label) {
  console.log(`\n▶ Agents du support, ${label}`);
  const agents = new Map();
  for (const r of rows) {
    const name = support.get(Number(r.id_op));
    if (!name) continue;
    if (!agents.has(name)) agents.set(name, { login: 0, catchup: 0, catchupN: 0, calls: 0, breaks: new Map() });
    const a = agents.get(name);
    const sec = Number(r.duration) || 0;
    if (r.type === 'login') a.login += sec;
    else if (r.type === 'catchup') { a.catchup += sec; a.catchupN++; }
    else if (r.type === 'call_in' || r.type === 'call_out') a.calls++;
    else if (r.type === 'break') {
      const k = typeof r.infos === 'object' ? JSON.stringify(r.infos) : String(r.infos || '(vide)');
      const b = a.breaks.get(k) || { n: 0, sec: 0, max: 0 };
      b.n++; b.sec += sec; b.max = Math.max(b.max, sec);
      a.breaks.set(k, b);
    }
  }
  if (!agents.size) { console.log('    aucune ligne'); return; }
  for (const [name, a] of agents) {
    const pause = [...a.breaks.values()].reduce((s, b) => s + b.sec, 0);
    console.log(`  ${name} : connecté ${fmtDur(a.login)}, ${a.calls} appel(s), `
      + `pause ${fmtDur(pause)}${a.login ? ` (${Math.round(pause / a.login * 100)} % du connecté)` : ''}, `
      + `post-appel ${fmtDur(a.catchup)} sur ${a.catchupN}`);
    for (const [k, b] of [...a.breaks].sort((x, y) => y[1].sec - x[1].sec)) {
      console.log(`      ${pauseLabel(k)} : ${b.n} pause(s), total ${fmtDur(b.sec)}, la plus longue ${Math.round(b.max / 60)} min`);
    }
  }
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
  const { rows, status } = await fetchStatus(today, today);
  if (!rows) {
    console.log(status === 401 || status === 403
      ? '\n✗ /vm/calls/status refusé (droits) — le token n\'a pas ce périmètre. Voir avec Axialys.'
      : '\n✗ /vm/calls/status : aucune forme de période acceptée (400). Le token passe, le format reste à trouver.');
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

    if (mine.length) agentBreakdown(rows, support, 'aujourd\'hui');
  }

  // ── 3. Une période passée : historique rejouable ou jour courant seulement ? ──
  console.log(`\n▶ Période passée demandée : ${past} → ${past}`);
  const { rows: old } = await fetchStatus(past, past);
  if (old) {
    summarize(old, 'passé');
    agentBreakdown(old, support, past);
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
