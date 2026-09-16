#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE : retrouver les machines d'un utilisateur dans OCS,
 * et la dernière IP connue, SANS passer par la base d'inventaire.
 *
 * POURQUOI : le support a besoin de situer une personne qui n'est pas (ou pas
 * encore) dans inventory_items. ESET ne peut pas répondre — il est centré
 * machine et n'expose aucun utilisateur connecté. OCS, lui, porte USERID,
 * IPADDR et LASTDATE dans sa section hardware.
 *
 * CE QUE CETTE PASSE TRANCHE, et qui décide du coût d'un futur endpoint :
 *   1. /computers/search accepte-t-il USERID comme il accepte NAME ? Si oui,
 *      une recherche coûte une requête ; sinon il faut parcourir le parc.
 *   2. USERID est-il réellement rempli, et sous quelle forme — « dlelong » ou
 *      « KARAVEL\\dlelong » ?
 *
 * CE QUE LA RÉPONSE VAUT, ET CE QU'ELLE NE VAUT PAS : USERID est la session
 * ouverte AU DERNIER INVENTAIRE de l'agent, pas une connexion en temps réel.
 * LASTDATE dit de quand la donnée date, et c'est pourquoi ce script l'affiche
 * toujours à côté de l'IP. En DHCP, l'adresse a pu changer depuis.
 *
 * Il n'écrit rien, ne touche pas à Supabase, et peut tourner en prod sans risque.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-ocs-user.js dlelong
 */
require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = process.env.OCS_URL || 'http://gestion-desktop.in.karavel.com';
const UID = (process.argv[2] || '').trim();
const PAGE = 200;         // taille de page du parcours
const MAX_PAGES = 30;     // garde-fou : 6000 machines au plus

if (!UID) { console.error('Usage : node scripts/probe-ocs-user.js <uid>'); process.exit(1); }
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

const hw = (e) => e?.hardware ?? {};
const line = (e) => {
  const h = hw(e);
  return `    ${String(h.NAME ?? '?').padEnd(22)} ${String(h.USERID ?? '').padEnd(18)} ` +
         `${String(h.IPADDR ?? h.IPSRC ?? '—').padEnd(16)} ${h.LASTDATE ?? h.LASTCOME ?? '?'}`;
};
const dateOf = (e) => new Date(hw(e).LASTDATE ?? hw(e).LASTCOME ?? 0).getTime() || 0;

(async () => {
  console.log(`\n══ Recherche de « ${UID} » dans OCS\n`);

  // ── 1. /computers/search accepte-t-il USERID ?
  console.log('── /computers/search avec le critère USERID');
  let searchWorks = false;
  for (const value of [UID, UID.toUpperCase()]) {
    const qs = new URLSearchParams({ start: '0', limit: '20', USERID: value });
    const r = await ocsFetch(`/ocsapi/v1/computers/search?${qs}`);
    const ids = entries(r.data).map(x => x?.ID).filter(v => v != null);
    console.log(`   USERID=${value.padEnd(12)} → HTTP ${r.status}, ${ids.length} id(s)${r.raw ? ` — ${r.raw}` : ''}`);
    if (r.status === 200 && ids.length) {
      searchWorks = true;
      console.log('\n   Détail des machines trouvées :');
      console.log(`    ${'NAME'.padEnd(22)} ${'USERID'.padEnd(18)} ${'IP'.padEnd(16)} DERNIER INVENTAIRE`);
      for (const id of ids.slice(0, 10)) {
        const d = await ocsFetch(`/ocsapi/v1/computer/${id}`);
        const e = entries(d.data)[0];
        if (e) console.log(line(e));
      }
      break;
    }
  }
  // Un 200 avec 0 résultat ne prouve rien : le critère peut être ignoré
  // silencieusement, et OCS rendre une liste vide comme il rendrait tout le parc.
  if (!searchWorks) console.log('   → critère non exploitable (refusé, ignoré, ou aucun résultat)');

  // ── 2. Parcours du parc, qui répond dans tous les cas
  console.log('\n── Parcours de /computers (mesure aussi le coût d\'un futur endpoint)');
  const all = [];
  const t0 = Date.now();
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await ocsFetch(`/ocsapi/v1/computers?start=${page * PAGE}&limit=${PAGE}`);
    const batch = entries(r.data);
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  const ms = Date.now() - t0;
  const withUser = all.filter(e => shortUser(hw(e).USERID)).length;
  console.log(`   ${all.length} machines parcourues en ${(ms / 1000).toFixed(1)} s`);
  console.log(`   USERID renseigné sur ${withUser} d'entre elles` +
              `${withUser === 0 ? ' — champ inutilisable, la piste s\'arrête là' : ''}`);

  const target = shortUser(UID);
  const found = all.filter(e => shortUser(hw(e).USERID) === target).sort((a, b) => dateOf(b) - dateOf(a));

  console.log(`\n── Machines de « ${UID} » : ${found.length}`);
  if (found.length) {
    console.log(`    ${'NAME'.padEnd(22)} ${'USERID'.padEnd(18)} ${'IP'.padEnd(16)} DERNIER INVENTAIRE`);
    for (const e of found) console.log(line(e));
    const last = found[0];
    console.log(`\n   ➜ Dernière IP connue : ${hw(last).IPADDR ?? hw(last).IPSRC ?? '—'} ` +
                `sur ${hw(last).NAME}, inventorié le ${hw(last).LASTDATE ?? hw(last).LASTCOME ?? '?'}`);
    console.log('     (session ouverte à cet inventaire, pas une connexion en direct)');
  } else {
    // Sans ce repli, on ne sait pas si l'uid est absent ou si on lit mal le champ.
    const sample = all.filter(e => shortUser(hw(e).USERID)).slice(0, 8);
    console.log('   aucune. Exemples d\'USERID réellement présents, pour vérifier la forme attendue :');
    for (const e of sample) console.log(`    ${hw(e).NAME} → ${JSON.stringify(hw(e).USERID)}`);
  }
  console.log();
})().catch(err => { console.error(err.message); process.exit(1); });
