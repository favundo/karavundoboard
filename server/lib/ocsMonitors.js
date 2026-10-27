/**
 * Écrans d'une machine d'après OCS — partie testable sans réseau
 * (src/test/ocsMonitors.test.ts).
 *
 * La section `monitors` du détail /computer/{id} vient de l'EDID lu par
 * l'agent (sondé le 27/10/2026, scripts/probe-ocs-monitors.js). Elle mêle :
 *   - les écrans externes : fabricant, modèle (CAPTION) et vrai n° de série —
 *     « Dell Computer Corp. — DELL E2724HS — 88XKH14 » ;
 *   - la dalle des portables : ni modèle ni série, fabricant de dalle (BOE,
 *     AUO…) ou « Unknown manufacturer code BOE ». Inutile au support, filtrée.
 *
 * CE QUE ÇA VAUT : les écrans branchés AU DERNIER INVENTAIRE, pas ceux de la
 * personne. Les docks du parc (Dell WD15 / WD25) sont en DisplayPort Alt Mode :
 * l'EDID les traverse, donc un portable inventorié docké remonte ses écrans, et
 * un portable inventorié hors dock n'en remonte aucun.
 */

/** Séries que l'EDID rend quand l'écran n'en publie pas. */
const FAKE_SERIAL = /^(0+|1+|01010101|00000001|12345678)$/i;

const clean = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};

/**
 * @returns {{ external: Array<{manufacturer, model, serial}>, builtIn: boolean }}
 */
function parseMonitors(list) {
  const external = [];
  const seen = new Set();
  let builtIn = false;
  for (const m of Array.isArray(list) ? list : []) {
    const model = clean(m?.CAPTION);
    const rawSerial = clean(m?.SERIAL);
    const serial = rawSerial && !FAKE_SERIAL.test(rawSerial) ? rawSerial : null;
    // Sans modèle, l'écran n'est pas identifiable : c'est la dalle d'un
    // portable dans tous les cas relevés.
    if (!model) { builtIn = true; continue; }
    // Un même écran remonte parfois deux fois (deux sorties, deux pilotes).
    const key = `${model}|${serial ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    external.push({ manufacturer: clean(m?.MANUFACTURER), model, serial });
  }
  return { external, builtIn };
}

module.exports = { parseMonitors };
