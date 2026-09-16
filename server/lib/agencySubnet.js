/**
 * Rapprochement d'une IP avec l'agence dont elle relève.
 *
 * Les collaborateurs du réseau agences n'ont pas de poste fixe et changent
 * d'agence régulièrement : c'est pourquoi ils ne sont pas saisis dans les
 * tables d'inventaire. Leur uid ne dit donc rien de l'endroit où ils sont —
 * mais l'IP relevée par OCS, si, parce que chaque agence a son sous-réseau.
 *
 * FORMAT DE sous_reseau : la colonne n'est affichée nulle part dans
 * l'interface et rien n'en garantit l'écriture. On accepte « 10.12.145.0 »,
 * « 10.12.145.0/24 », « 10.12.145 » et « 10.12.145.x ». Le masque est lu quand
 * il ressemble à un masque, sinon on retombe sur /24 — la taille d'un
 * sous-réseau d'agence dans l'immense majorité des cas.
 *
 * Isolé de index.js parce que l'arithmétique de masques ne se vérifie pas à la
 * lecture : elle se teste (src/test/agencySubnet.test.ts).
 */

/** « 10.12.145.0 », « 10.12.145.0/24 », « 10.12.145 » → l'entier 32 bits. */
function ipToInt(s) {
  const m = /(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?/.exec(String(s || ''));
  if (!m) return null;
  const o = [m[1], m[2], m[3] ?? '0', m[4] ?? '0'].map(Number);
  if (o.some(n => Number.isNaN(n) || n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

/** « 255.255.255.0 » ou « /24 » → 24. Défaut : 24. */
function prefixLength(sousReseau, masque) {
  const slash = /\/(\d{1,2})\b/.exec(String(sousReseau || ''));
  if (slash) return Math.min(32, Number(slash[1]));
  const asInt = ipToInt(masque);
  if (asInt != null && /^\d{1,3}(\.\d{1,3}){3}$/.test(String(masque || '').trim())) {
    // Un masque valide est une suite de 1 puis de 0 : on compte les 1. Une
    // valeur fantaisiste retombe sur /24 plutôt que de produire un réseau absurde.
    const bits = asInt.toString(2).padStart(32, '0');
    if (/^1*0*$/.test(bits)) return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
  }
  return 24;
}


/**
 * Lignes d'agency_inventory → réseaux dédupliqués et prêts à comparer.
 *
 * Plusieurs postes partagent le sous-réseau de leur agence : sans
 * déduplication, on comparerait la même plage des dizaines de fois.
 */
function buildSubnets(rows) {
  const seen = new Map();
  for (const row of rows ?? []) {
    const net = ipToInt(row?.sous_reseau);
    if (net == null || !row?.agence) continue;
    const prefix = prefixLength(row.sous_reseau, row.masque);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const key = `${(net & mask) >>> 0}/${prefix}`;
    if (!seen.has(key)) {
      seen.set(key, {
        agence: row.agence, sousReseau: row.sous_reseau,
        network: (net & mask) >>> 0, mask,
      });
    }
  }
  return [...seen.values()];
}

/**
 * Réseau contenant cette IP, ou null.
 *
 * Du plus spécifique au plus large : un /27 doit l'emporter sur un /16 qui le
 * contiendrait, sinon deux agences imbriquées se répondent l'une pour l'autre.
 */
function matchSubnet(ip, nets) {
  const addr = ipToInt(ip);
  if (addr == null) return null;
  const hit = (nets ?? [])
    .filter(n => ((addr & n.mask) >>> 0) === n.network)
    .sort((a, b) => b.mask - a.mask)[0];
  return hit ? { agence: hit.agence, sousReseau: hit.sousReseau } : null;
}

module.exports = { ipToInt, prefixLength, buildSubnets, matchSubnet };
