#!/usr/bin/env node
// Bac à sable pour tester les requêtes RT REST 1.0 avant de les implémenter
// dans server/index.js. Affiche la réponse brute de RT (pas de parsing).
//
// Credentials : server/.env (RT_URL / RT_USER / RT_PASS) ou variables d'env.
//
//   node scripts/rt-test.mjs ticket 12345
//   node scripts/rt-test.mjs history 12345
//   node scripts/rt-test.mjs search "Queue = 'Support' AND Status = 'open'"
//   node scripts/rt-test.mjs search "Created > '2026-08-01'" --rows 20 --format s
//   node scripts/rt-test.mjs raw "/REST/1.0/queues/1"
//   node scripts/rt-test.mjs user fabien.vundo

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// server/.env : KEY=value, guillemets optionnels, # en commentaire
for (const file of ['server/.env', '.env']) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

const BASE = process.env.RT_URL || 'http://rt.in.karavel.com';
const USER = process.env.RT_USER;
const PASS = process.env.RT_PASS;

if (!USER || !PASS) {
  console.error('✗ RT_USER / RT_PASS manquants (server/.env ou variables d\'env)');
  process.exit(1);
}

// --rows 20 --format s → { rows: '20', format: 's' }, le reste en positionnel
const argv = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else args.push(argv[i]);
}

const [cmd, arg] = args;

async function rt(pathname, extra = {}) {
  const params = new URLSearchParams({ user: USER, pass: PASS, ...extra });
  const url = `${BASE}${pathname}?${params}`;
  const started = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  const masked = url.replace(encodeURIComponent(PASS), '***').replace(PASS, '***');
  console.error(`→ ${masked}`);
  console.error(`← HTTP ${res.status} · ${text.length} octets · ${Date.now() - started} ms\n`);
  return text;
}

const commands = {
  ticket:  () => rt(`/REST/1.0/ticket/${arg}/show`),
  history: () => rt(`/REST/1.0/ticket/${arg}/history`, { format: flags.format || 'l' }),
  links:   () => rt(`/REST/1.0/ticket/${arg}/links/show`),
  attach:  () => rt(`/REST/1.0/ticket/${arg}/attachments`),
  user:    () => rt(`/REST/1.0/user/${arg}`),
  queue:   () => rt(`/REST/1.0/queue/${arg}`),
  search:  () => rt('/REST/1.0/search/ticket', {
    query: arg,
    orderby: flags.orderby || '-Created',
    rows: flags.rows || '10',
    format: flags.format || 'l',
  }),
  raw:     () => rt(arg),
};

if (!commands[cmd] || (cmd !== 'raw' && !arg)) {
  console.error(`Usage: node scripts/rt-test.mjs <${Object.keys(commands).join('|')}> <arg> [--rows N] [--format s|l] [--orderby -Created]`);
  process.exit(1);
}

console.log(await commands[cmd]());
