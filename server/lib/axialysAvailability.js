/**
 * Disponibilité réelle de la ligne du support, heure par heure.
 *
 * LA QUESTION : on décroche 58 % des appels. Le planning dit combien de
 * techniciens étaient prévus, mais pas combien la ligne pouvait réellement
 * faire sonner. Un agent connecté mais en pause n'est jamais sollicité par la
 * file — c'est ce qui fait les abandons (ABORT) de 13 h, sans un seul
 * non-répondu.
 *
 * LA SOURCE : POST /vm/calls/status, l'historique des états des agents. Une
 * ligne `login` par session, une ligne `break` par pause, chacune avec sa date
 * de DÉBUT et sa durée. Contrairement aux appels, l'historique se rejoue —
 * sondé le 05/10/2026 avec scripts/probe-axialys-status.js.
 *
 * Deux faits qui pèsent sur le calcul, constatés sur les données réelles :
 *   - une session n'apparaît qu'à la DÉCONNEXION : la journée en cours rend
 *     « connecté 0 h 00 ». On ne mesure donc qu'une journée close ;
 *   - toutes les pauses rendent l'agent injoignable par la file, quel qu'en soit
 *     le motif — y compris « Appel interne » (user0) et « Indisponible »
 *     (user15, posée à chaque connexion). Le motif n'entre pas dans le calcul,
 *     et n'est pas affiché : on mesure la ligne, pas les personnes.
 *
 * Isolé de index.js pour se tester sans réseau (src/test/axialysAvailability.test.ts).
 */

const KEPT_TYPES = new Set(['login', 'break']);

/**
 * Une ligne de /vm/calls/status → une ligne de axialys_agent_status, ou null.
 *
 * On ne garde que `login` et `break`. Les appels sont déjà dans axialys_calls,
 * et `catchup` (post-appel) dure 3 à 4 s par appel — un enchaînement
 * automatique, pas une indisponibilité qui vaille d'être stockée.
 */
function normalizeStatusRow(r, day) {
  if (!r || !KEPT_TYPES.has(r.type)) return null;
  const id_op = Number(r.id_op);
  const duration = Number(r.duration);
  const started = r.date ? new Date(r.date) : null;
  if (!Number.isInteger(id_op) || !Number.isFinite(duration) || duration < 0) return null;
  if (!started || Number.isNaN(started.getTime())) return null;
  return {
    id_op,
    type: r.type,
    started_at: started.toISOString(),
    duration: Math.round(duration),
    // Code du motif (« user6 ») — libellés dans PAUSE_LABELS de la sonde.
    infos: r.type === 'break' && r.infos ? String(r.infos) : null,
    day,
  };
}

/**
 * Découpe [start, start + duration] en secondes par (jour, heure) locaux.
 *
 * On avance d'une frontière d'heure UTC à la suivante : Paris est décalé d'un
 * nombre entier d'heures, donc chaque tranche tombe dans une seule heure
 * locale, changements d'heure compris.
 */
function splitByHour(startIso, durationSec, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  });
  const out = [];
  let t = new Date(startIso).getTime();
  const end = t + durationSec * 1000;
  while (t < end) {
    const next = Math.min(end, (Math.floor(t / 3600000) + 1) * 3600000);
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map(p => [p.type, p.value]));
    out.push({
      day: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour) % 24,          // certains moteurs rendent « 24 » à minuit
      sec: (next - t) / 1000,
    });
    t = next;
  }
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;

/**
 * Moyenne, pour chaque heure de la journée, du nombre d'agents prévus,
 * connectés, et joignables (connectés hors pause).
 *
 * `statusDays` : les jours dont l'historique a été relevé avec succès. C'est le
 * dénominateur, et c'est lui qui fait qu'un jour non relevé ne passe pas pour
 * un jour sans personne.
 *
 * `shifts` : créneaux du planning TSI, { day, start, end } en heures décimales
 * locales. `plannedDays` : jours que le planning couvre. « Prévus » n'est
 * moyenné que sur les jours relevés ET planifiés ; sans aucun, il vaut null —
 * pas zéro.
 *
 * La couverture est FRACTIONNAIRE : un créneau qui finit à 17h30 compte pour
 * une demi-personne à 17 h. Compter des têtes présentes masquerait justement
 * le trou de 17 h, la ligne étant ouverte jusqu'à 18 h.
 */
function hourlyAvailability({ rows, statusDays, shifts = [], plannedDays = [], tz }) {
  const days = new Set(statusDays);
  const nDays = days.size;
  const planDays = new Set(plannedDays.filter(d => days.has(d)));
  const nPlan = planDays.size;

  const login = new Array(24).fill(0);
  const pause = new Array(24).fill(0);
  for (const r of rows) {
    const target = r.type === 'login' ? login : r.type === 'break' ? pause : null;
    if (!target) continue;
    for (const s of splitByHour(r.started_at, r.duration, tz)) {
      if (days.has(s.day)) target[s.hour] += s.sec;
    }
  }

  const planned = new Array(24).fill(0);
  for (const s of shifts) {
    if (!planDays.has(s.day)) continue;
    for (let h = Math.floor(s.start); h < Math.ceil(s.end) && h < 24; h++) {
      planned[h] += Math.max(0, Math.min(s.end, h + 1) - Math.max(s.start, h));
    }
  }

  return {
    days: nDays,
    plannedDays: nPlan,
    byHour: Array.from({ length: 24 }, (_, hour) => {
      const connected = nDays ? login[hour] / 3600 / nDays : 0;
      // Une pause ne peut pas dépasser la session qui la porte : on borne, au
      // cas où une pause chevauche une déconnexion.
      const paused = nDays ? Math.min(pause[hour] / 3600 / nDays, connected) : 0;
      return {
        hour,
        planned: nPlan ? round1(planned[hour] / nPlan) : null,
        connected: round1(connected),
        reachable: round1(connected - paused),
        paused: round1(paused),
      };
    }),
  };
}

module.exports = { normalizeStatusRow, splitByHour, hourlyAvailability };
