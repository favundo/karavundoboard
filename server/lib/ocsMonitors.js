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
 * personne. Et un écran derrière un dock DisplayLink n'est pas vu : le pilote
 * ne transmet pas l'EDID. D'où `dock`, cherché dans les périphériques USB, pour
 * qu'une liste vide ne passe pas pour « pas d'écran ».
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

const DOCK_RE = /displaylink|dock/i;

/** Nom du premier périphérique qui ressemble à un dock, ou null. */
function findDock(...sections) {
  for (const section of sections) {
    for (const d of Array.isArray(section) ? section : []) {
      const hit = Object.values(d ?? {}).find(v => typeof v === 'string' && DOCK_RE.test(v));
      if (hit) return hit.trim();
    }
  }
  return null;
}

module.exports = { parseMonitors, findDock };
