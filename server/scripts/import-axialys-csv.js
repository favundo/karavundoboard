#!/usr/bin/env node
/**
 * Rattrapage de l'historique téléphonie depuis un export CSV du portail Axialys.
 *
 * POURQUOI CE SCRIPT EXISTE : l'API Axialys ne rend que les dernières 24-48 h
 * (elle ignore dt / dt_end). Le job quotidien de server/index.js capture donc
 * l'avenir, mais il ne peut rien pour le passé. Le seul moyen de récupérer
 * l'historique est un export depuis admin.axialys.net.
 *
 * CE QUE L'EXPORT NE CONTIENT PAS, et qu'il faut avoir en tête :
 *   • ni duration_wait, ni duration_svi, ni post_appel — donc aucune mesure de
 *     temps d'attente sur la période rattrapée. Les lignes sont marquées
 *     source='csv' et les moyennes d'attente les écartent, plutôt que de
 *     compter des zéros qui n'en sont pas ;
 *   • pas d'id_op, seulement le nom de l'agent. Les statistiques reconstruisent
 *     la correspondance nom → id_op à partir des lignes venues de l'API.
 *
 * ATTENTION AU FILTRE DE L'EXPORT : un export « summary » sans les appels
 * manqués donne 182 entrants tous en ANSWER, soit 100 % de décroché — un
 * chiffre faux qui a l'air parfaitement crédible. Vérifier dans le portail que
 * les appels non aboutis sont inclus avant d'importer. Le script prévient si
 * aucun entrant manqué n'est trouvé.
 *
 * Usage :
 *   cd server && node scripts/import-axialys-csv.js export1.csv [export2.csv…]
 *   node scripts/import-axialys-csv.js --dry-run export.csv
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const GROUP = process.env.AXIALYS_GROUP || 'Support IT KVL';

/** Parseur CSV minimal mais correct : guillemets, doublage "" et virgules internes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  // Le portail exporte en UTF-8 avec BOM : non retiré, il colle au premier
  // nom de colonne et « ID » devient introuvable.
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const head = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.length === head.length)
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const numOrNull = (v) => (v === '' || v === undefined ? null : Number(v));

function toRow(r) {
  const id = numOrNull(r['ID appel'] || r['ID']);
  if (id === null || !Number.isFinite(id)) return null;

  const type = (r['Type'] || '').toLowerCase();
  if (type !== 'in' && type !== 'out') return null;

  return {
    id_appel:         id,
    direction:        type,
    call_date:        new Date(r['Date']).toISOString(),
    status:           r['Statut'] || null,
    caller_number:    r['N° du contact'] || null,
    group_name:       r['1er Groupe'] || null,
    first_group_name: r['1er Groupe'] || null,
    op_name:          r['1er Agent'] || null,
    tags:             r['Tags'] || null,
    duration_comm:    numOrNull(r['Duree communication']),
    source:           'csv',
  };
}

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files  = args.filter(a => !a.startsWith('--'));

  if (!files.length) {
    console.error('Usage : node scripts/import-axialys-csv.js [--dry-run] <export.csv…>');
    process.exit(1);
  }

  const byId = new Map();   // dédoublonne entre fichiers qui se recouvrent
  let skippedGroup = 0, skippedShape = 0;

  for (const f of files) {
    const parsed = parseCsv(fs.readFileSync(f, 'utf8'));
    let kept = 0;
    for (const raw of parsed) {
      const row = toRow(raw);
      if (!row) { skippedShape++; continue; }
      // Même règle qu'à l'ingestion API : rien d'autre que le support IT
      // n'entre en base, même si l'export en contient.
      if (row.group_name !== GROUP) { skippedGroup++; continue; }
      byId.set(row.id_appel, row);
      kept++;
    }
    console.log(`${f} — ${parsed.length} lignes, ${kept} retenues`);
  }

  const rows = [...byId.values()];
  const ins  = rows.filter(r => r.direction === 'in');
  const miss = ins.filter(r => r.status !== 'ANSWER');

  console.log(`\n${rows.length} appels distincts à importer`);
  console.log(`  entrants ${ins.length}, dont manqués ${miss.length}`);
  console.log(`  sortants ${rows.length - ins.length}`);
  if (skippedGroup) console.log(`  ${skippedGroup} lignes hors « ${GROUP} » ignorées`);
  if (skippedShape) console.log(`  ${skippedShape} lignes illisibles ignorées`);

  if (ins.length && miss.length === 0) {
    console.warn('\n⚠️  AUCUN entrant manqué dans cet export : 100 % de décroché.');
    console.warn('    C\'est presque sûrement un export filtré sur les appels aboutis.');
    console.warn('    Importé tel quel, il rendra un taux de décroché faux et crédible.');
    console.warn('    Réexporter en incluant les appels non aboutis.');
    if (!dryRun) { console.warn('    Import interrompu. Relancer avec --force pour passer outre.'); }
    if (!dryRun && !process.argv.includes('--force')) process.exit(2);
  }

  if (dryRun) { console.log('\n--dry-run : rien n\'a été écrit.'); return; }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    // ignoreDuplicates : une ligne déjà posée par l'API est PLUS riche (elle a
    // le temps d'attente et le post-appel). L'écraser par la version CSV
    // détruirait de l'information.
    const { error } = await supabase
      .from('axialys_calls')
      .upsert(batch, { onConflict: 'id_appel', ignoreDuplicates: true });
    if (error) { console.error('Erreur Supabase :', error.message); process.exit(1); }
    written += batch.length;
  }
  console.log(`\n${written} lignes envoyées (les doublons de l'API ont été préservés).`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
