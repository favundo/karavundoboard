#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE de la fenêtre réellement rendue par l'API Axialys.
 *
 * POURQUOI : le job quotidien n'ingérait que 0 à 3 appels par nuit. La sonde a
 * montré le 11/09/2026 que l'API ne rend que le jour courant depuis minuit
 * lorsqu'on l'interroge avec dt / dt_end.
 *
 * MAIS la documentation (guide.axialys.com/guide/call-history-api) nomme les
 * paramètres de période « date » et « date_end », pas « dt » / « dt_end ».
 * L'API valide bien la présence de dt / dt_end — sans eux, 400 INVALID_VARS
 * « check: dt,dt_end » — mais rien ne dit qu'elle s'en serve pour filtrer.
 * D'où le soupçon : dt passe la validation, le vrai filtre reste vide, et
 * l'API retombe sur son défaut, le jour courant.
 *
 * Ce script essaie les trois combinaisons sur une période PASSÉE et affiche les
 * dates réellement rendues par chacune. Si « date / date_end » rend la période
 * demandée, l'historique est rejouable et tout le dispositif de capture
 * quotidienne devient un simple confort.
 *
 * La doc précise que la recherche est limitée à un mois quand les deux bornes
 * sont fournies.
 *
 * Il n'écrit rien, ne touche pas à Supabase, et peut tourner en prod sans risque.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-axialys-window.js
 *   cd /opt/karavundoboard/server && node scripts/probe-axialys-window.js 2026-09-08 2026-09-10
 */

require('dotenv').config();
const https = require('https');
const http  = require('http');

const AX_BASE  = process.env.AXIALYS_URL   || 'https://api.axialys.com';
const AX_TOKEN = process.env.AXIALYS_TOKEN;
const AX_GROUP = process.env.AXIALYS_GROUP || 'Support IT KVL';
const AX_TZ    = process.env.AXIALYS_TZ    || 'Europe/Paris';

if (!AX_TOKEN) {
  console.error('AXIALYS_TOKEN absent — rien à sonder.');
  process.exit(1);
}

function axialysPost(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url  = new URL(path, AX_BASE);
    const lib  = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `APIKey ${AX_TOKEN}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} — ${data.slice(0, 200)}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(Array.isArray(json) ? json : (json.data || []));
        } catch (e) { reject(new Error(`Réponse illisible : ${data.slice(0, 120)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('timeout Axialys')));
    req.write(body);
    req.end();
  });
}

const inSupportGroup = (c) =>
  c.group_name === AX_GROUP || c.first_group_name === AX_GROUP;

/** Jour local Paris d'un horodatage Axialys, pour compter comme l'application. */
const localDay = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '??';
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: AX_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
};

const localTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '??';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: AX_TZ, dateStyle: 'short', timeStyle: 'medium',
  }).format(d);
};

function report(label, calls) {
  console.log(`\n═══ ${label} — ${calls.length} appels rendus par l'API`);
  if (!calls.length) return;

  const dated = calls.filter(c => c.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length) {
    console.log(`    plus ancien : ${localTime(dated[0].date)}`);
    console.log(`    plus récent : ${localTime(dated[dated.length - 1].date)}`);
  }
  console.log(`    sans date   : ${calls.length - dated.length}`);

  const perDay = new Map();
  for (const c of calls) {
    const day = c.date ? localDay(c.date) : '??';
    if (!perDay.has(day)) perDay.set(day, { tous: 0, support: 0 });
    const e = perDay.get(day);
    e.tous += 1;
    if (inSupportGroup(c)) e.support += 1;
  }
  console.log('    jour (Paris)   tous Karavel   dont support');
  for (const day of [...perDay.keys()].sort()) {
    const e = perDay.get(day);
    console.log(`    ${day}       ${String(e.tous).padStart(6)}        ${String(e.support).padStart(6)}`);
  }

  // Si le filtre groupe ne ramène rien, c'est peut-être le libellé qui a changé :
  // on montre les groupes réellement présents pour pouvoir en juger.
  const total = calls.filter(inSupportGroup).length;
  if (total === 0) {
    const groupes = new Map();
    for (const c of calls) {
      for (const g of [c.group_name, c.first_group_name]) {
        if (g) groupes.set(g, (groupes.get(g) || 0) + 1);
      }
    }
    console.log(`\n    ⚠ aucun appel ne porte le groupe « ${AX_GROUP} ».`);
    console.log('    Groupes présents dans la réponse :');
    for (const [g, n] of [...groupes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`      ${String(n).padStart(5)}  ${g}`);
    }
  }
}

(async () => {
  console.log(`Sonde lancée le ${localTime(new Date().toISOString())} (${AX_TZ})`);
  console.log(`Groupe filtré : « ${AX_GROUP} »`);

  // Par défaut on sonde une période passée et fermée : c'est le seul cas qui
  // distingue un filtre qui marche d'un filtre ignoré. Sonder aujourd'hui ne
  // prouverait rien, puisque le défaut de l'API est déjà aujourd'hui.
  const [argFrom, argTo] = process.argv.slice(2);
  const from = argFrom || '2026-09-08';
  const to   = argTo   || '2026-09-10';
  console.log(`Période demandée : ${from} → ${to}`);

  // Trois jeux de paramètres, même période. Seul celui qui rend autre chose que
  // la date du jour prouve que le filtre est pris en compte.
  const variantes = [
    ['dt / dt_end (ce que fait le code aujourd\'hui)', { dt: from, dt_end: to }],
    ['date / date_end (ce que dit la documentation)',   { date: from, date_end: to }],
    ['les quatre ensemble',                             { dt: from, dt_end: to, date: from, date_end: to }],
  ];

  for (const [label, payload] of variantes) {
    console.log(`\n${'━'.repeat(70)}`);
    console.log(`VARIANTE — ${label}`);
    console.log(`  payload : ${JSON.stringify(payload)}`);
    for (const [path, sens] of [['/vm/calls/in', 'ENTRANTS'], ['/vm/calls/out', 'SORTANTS']]) {
      try {
        report(`${label} · ${sens}`, await axialysPost(path, payload));
      } catch (err) {
        console.error(`\n═══ ${sens} — échec : ${err.message}`);
      }
    }
  }

  console.log(`\n${'━'.repeat(70)}`);
  console.log(`Lecture : une variante qui rend ${from}…${to} filtre vraiment.`);
  console.log(`Une variante qui ne rend que ${localDay(new Date().toISOString())} ignore ses paramètres.`);
})();
