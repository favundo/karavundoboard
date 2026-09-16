#!/usr/bin/env node
/**
 * Sonde en LECTURE SEULE de ce qu'ESET rend réellement pour le parc.
 *
 * CE QU'ON SAIT DÉJÀ (mesures du 16/09/2026, 904 devices) :
 *
 *   ✔ /v1/devices rend l'objet COMPLET — operatingSystem inclus — là où
 *     /v1/device_groups/.../devices ne rend que displayName, groupUuid, uuid.
 *     Les deux couvrent le même parc. C'est donc /v1/devices la bonne source :
 *     une page paginée au lieu de 700 appels unitaires.
 *   ✔ operatingSystem.displayName est exploitable sur 902 devices sur 904.
 *   ✘ activeProducts et deployedComponents sont VIDES sur la totalité du parc,
 *     et l'API REST n'expose aucune autre ressource (404 sur une douzaine de
 *     candidates). ESET ne peut pas alimenter `eset_app` — décision du
 *     16/09/2026 : cette colonne reste à la saisie manuelle.
 *
 * À QUOI SERT CE SCRIPT AUJOURD'HUI : revérifier, avant de soupçonner le code,
 * que la source tient toujours ses promesses — le parc est-il complet, l'OS
 * toujours rempli, et à quoi ressemblerait le camembert après normalisation.
 *
 * Il n'écrit rien, ne touche pas à Supabase, et peut tourner en prod sans risque.
 *
 * Usage :
 *   cd /opt/karavundoboard/server && node scripts/probe-eset-fields.js
 *   cd /opt/karavundoboard/server && node scripts/probe-eset-fields.js port13559
 */
require('dotenv').config();
const https = require('https');
const { normalizeOs } = require('../lib/inventoryNormalize');

const BASE = process.env.ESET_URL || 'https://antivirus03.in.karavel.com:9443';

if (!process.env.ESET_USER || !process.env.ESET_PASS) {
  console.error('ESET_USER / ESET_PASS absents du .env — rien à sonder.');
  process.exit(1);
}

const request = (options, body) => new Promise((resolve, reject) => {
  const req = https.request({ ...options, rejectUnauthorized: false }, (res) => {
    let data = '';
    res.on('data', c => { data += c; });
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error(`Réponse non-JSON (${res.statusCode}) : ${data.slice(0, 200)}`)); }
    });
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const tally = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const top = (m, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => `    ${String(v).padStart(4)} × ${k}`).join('\n');

(async () => {
  const url = new URL(BASE);
  const body = JSON.stringify({ username: process.env.ESET_USER, password: process.env.ESET_PASS });
  const auth = await request({
    hostname: url.hostname, port: url.port || 443, path: '/GetTokens', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  const token = auth.token ?? auth.access_token ?? auth.Token ?? auth.accessToken;
  if (!token) throw new Error(`Pas de token : ${JSON.stringify(auth).slice(0, 200)}`);

  const get = (path) => request({
    hostname: url.hostname, port: url.port || 443, path,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  // ── 1. Pagination complète de /v1/devices
  const all = [];
  let pageToken = '', pages = 0;
  const t0 = Date.now();
  do {
    const params = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await get(`/v1/devices?${params}`);
    const batch = r?.devices ?? r?.items ?? [];
    all.push(...batch);
    pageToken = r?.nextPageToken ?? '';
    pages += 1;
    if (pages > 20) break;                    // garde-fou anti-boucle
  } while (pageToken);
  const ms = Date.now() - t0;

  console.log(`\n── /v1/devices paginé : ${all.length} devices en ${pages} page(s), ${(ms / 1000).toFixed(1)} s`);
  console.log(`   (la liste du groupe racine en rendait 904 — ${all.length === 904 ? 'même parc ✔' : 'ÉCART, à comprendre avant de basculer ⚠'})`);

  // ── 2. Taux de remplissage réel des champs qui nous intéressent
  const withOs   = all.filter(d => d?.operatingSystem?.displayName).length;
  const withProd = all.filter(d => (d?.activeProducts ?? []).length).length;
  console.log(`\n── Remplissage sur ${all.length} devices`);
  console.log(`   operatingSystem.displayName : ${withOs}`);
  // Laissé en place comme témoin : si ce compteur cessait un jour d'être nul,
  // c'est qu'ESET publierait enfin le produit installé.
  console.log(`   activeProducts non vide     : ${withProd}`);

  const osCounts = new Map();
  for (const d of all) {
    const n = normalizeOs(d?.operatingSystem?.displayName);
    if (n) tally(osCounts, n);
  }
  console.log(`\n── Ce que windows_version vaudrait après normalisation`);
  console.log(top(osCounts));

  // ── 3. Un poste nommé, pour lecture à l'œil
  const wanted = (process.argv[2] || '').toLowerCase();
  if (wanted) {
    const d = all.find(x => String(x.displayName ?? '').toLowerCase().split('.')[0] === wanted);
    console.log(`\n── « ${wanted} » en entier`);
    console.log(d ? JSON.stringify(d, null, 2).slice(0, 2000) : '   absent du parc ESET.');
  }
  console.log();
})().catch(err => { console.error(err.message); process.exit(1); });
