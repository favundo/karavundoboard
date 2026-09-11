#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE de la fenêtre réellement rendue par l'API Axialys.
 *
 * POURQUOI : le job quotidien de 04h05 n'ingère que 0 à 3 appels par nuit, alors
 * que le support en traite 20-30 par jour. L'hypothèse est que la fenêtre de
 * l'API n'est pas « les dernières 24-48 h » mais un créneau ancré sur le jour
 * courant — auquel cas à 04h05 il n'y a rien à prendre, et l'heure du cron est
 * le bug. Ce script répond à la question : quelles dates l'API rend-elle,
 * à l'instant où on l'appelle ?
 *
 * Il n'écrit rien, ne touche pas à Supabase, et peut tourner en prod sans risque.
 * À lancer plusieurs fois dans la journée (matin, midi, soir) pour voir si la
 * fenêtre glisse ou si elle repart de minuit.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-axialys-window.js
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

  // Mêmes paramètres que le job : ignorés par l'API, mais obligatoires sans quoi
  // elle répond 400 INVALID_VARS « check: dt,dt_end ».
  const today     = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const window    = { dt: yesterday.toISOString().slice(0, 10), dt_end: today.toISOString().slice(0, 10) };
  console.log(`Paramètres envoyés : dt=${window.dt} dt_end=${window.dt_end}`);

  for (const [path, label] of [['/vm/calls/in', 'ENTRANTS'], ['/vm/calls/out', 'SORTANTS']]) {
    try {
      report(label, await axialysPost(path, window));
    } catch (err) {
      console.error(`\n═══ ${label} — échec : ${err.message}`);
    }
  }
})();
