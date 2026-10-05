/**
 * Rapport mensuel individuel des techniciens : tickets RT et téléphonie.
 *
 * Séparé de index.js pour se tester sans réseau : ici on ne fait qu'agréger des
 * lignes déjà lues (RT, axialys_calls) et rendre le mail. La lecture des
 * sources et l'envoi restent dans index.js.
 *
 * Le rapport est destiné à la personne, pas à un classement : ses chiffres, ceux
 * de son mois précédent, et la moyenne de l'équipe — jamais les chiffres nommés
 * d'un collègue ni un rang. Chaque indicateur porte ce qu'il mesure, parce
 * qu'un chiffre qu'on ne sait pas lire ne fait rien progresser.
 */

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ─── Périodes ────────────────────────────────────────────────────────────────

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** « septembre 2026 » */
function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_FR[m - 1]} ${y}`;
}

/** Date locale « YYYY-MM-DD » et jour de semaine (0 = dimanche) dans `tz`. */
function localDate(date, tz) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const wd  = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return { day, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd) };
}

// Fériés tombant sur les trois premiers jours d'un mois — les seuls qui
// peuvent décaler l'envoi. Les fériés mobiles n'y tombent jamais.
const HOLIDAYS_EARLY_MONTH = new Set(['01-01', '05-01', '11-01']);

/**
 * Vrai si `day` (« YYYY-MM-DD ») est le premier jour ouvré de son mois. Le
 * rapport part ce jour-là plutôt que le 1er : le 1er novembre 2026 est un
 * dimanche, et un rapport lu le lundi au milieu d'une boîte pleine n'est pas lu.
 */
function isFirstWorkdayOfMonth(day) {
  const [y, m, d] = day.split('-').map(Number);
  const worked = (n) => {
    const wd = new Date(Date.UTC(y, m - 1, n)).getUTCDay();
    const md = `${String(m).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    return wd !== 0 && wd !== 6 && !HOLIDAYS_EARLY_MONTH.has(md);
  };
  if (!worked(d)) return false;
  for (let n = 1; n < d; n++) if (worked(n)) return false;
  return true;
}

// ─── Tickets RT ──────────────────────────────────────────────────────────────

/** "2026-08-06 08:52" (heure locale RT). Vide ou "Not set" → null. */
function parseRTDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Agrège les tickets clos d'un mois par propriétaire.
 *
 * `rows` : lignes RT (id, Owner, Queue, Status, Created, Resolved, Priority),
 * qui peuvent déborder du mois — on filtre ici sur le préfixe de `Resolved`,
 * déjà en heure locale RT, plutôt que de se fier aux bornes de la requête.
 * `difficulty` : Map id → note 1-5, pour les seuls tickets notés.
 *
 * Mêmes règles que le score de l'onglet Stats support : rejets hors travail,
 * tickets non notés hors score et hors difficulté moyenne, bonus de priorité
 * indépendant de la note.
 */
function aggregateTickets(rows, difficulty, month, priorityBonus) {
  const owners = new Map();
  const get = (login) => {
    const key = login || 'Nobody';
    if (!owners.has(key)) {
      owners.set(key, {
        resolved: 0, rejected: 0, sameDay: 0, delays: [], byQueue: {},
        scored: 0, difficultySum: 0, difficulty: [0, 0, 0, 0, 0],
        bonus: 0, urgent: 0, perDay: {},
      });
    }
    return owners.get(key);
  };

  for (const t of rows) {
    if ((t.Resolved || '').slice(0, 7) !== month) continue;
    const o = get(t.Owner);
    if (t.Status === 'rejected') { o.rejected++; continue; }
    if (t.Status !== 'resolved') continue;

    o.resolved++;
    o.byQueue[t.Queue] = (o.byQueue[t.Queue] || 0) + 1;
    const day = t.Resolved.slice(0, 10);
    o.perDay[day] = (o.perDay[day] || 0) + 1;

    const cre = parseRTDate(t.Created);
    const res = parseRTDate(t.Resolved);
    if (cre && res && res >= cre) {
      o.delays.push((res - cre) / 3600000);
      if (t.Created.slice(0, 10) === day) o.sameDay++;
    }

    const bonus = priorityBonus(parseInt(t.Priority, 10) || 0);
    if (bonus) { o.bonus += bonus; o.urgent++; }

    const level = difficulty.get(String(t.id));
    if (level) {
      o.scored++;
      o.difficultySum += level;
      o.difficulty[level - 1]++;
    }
  }

  const out = new Map();
  for (const [login, o] of owners) {
    let bestDay = null;
    for (const [date, count] of Object.entries(o.perDay)) {
      if (!bestDay || count > bestDay.count) bestDay = { date, count };
    }
    out.set(login, {
      resolved:      o.resolved,
      rejected:      o.rejected,
      byQueue:       o.byQueue,
      medianHours:   median(o.delays),
      sameDayPct:    o.resolved ? o.sameDay / o.resolved : null,
      scored:        o.scored,
      avgDifficulty: o.scored ? o.difficultySum / o.scored : null,
      difficulty:    o.difficulty,
      score:         o.difficultySum + o.bonus,
      bonus:         o.bonus,
      urgent:        o.urgent,
      bestDay,
      delays:        o.delays,
    });
  }
  return out;
}

// ─── Téléphonie ──────────────────────────────────────────────────────────────

/**
 * Clé d'agent Axialys : le prénom, sans l'équipe qui le suit (« Remy TSI »).
 * Les lignes rattrapées par CSV n'ont pas d'id_op, le prénom est donc la seule
 * clé commune aux deux sources.
 */
function axialysAgentKey(opName) {
  const first = String(opName || '').trim().split(/\s+/)[0] || '';
  return first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() || null;
}

/**
 * Agrège les appels d'un mois : par agent, et pour la ligne entière.
 *
 * Un appel manqué n'appartient à personne — aucun agent ne l'a pris — il n'est
 * donc compté qu'au niveau de la ligne. L'attribuer à quelqu'un serait faux, et
 * c'est précisément l'information que le rapport doit expliquer plutôt que
 * reprocher.
 */
function aggregateCalls(calls, month, tz) {
  const agents = new Map();
  const line = {
    inbound: 0, answered: 0, missed: 0, outbound: 0,
    byHour: new Map(), days: new Set(), csvOnly: true,
  };
  const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });

  for (const c of calls) {
    const when = new Date(c.call_date);
    const { day } = localDate(when, tz);
    if (day.slice(0, 7) !== month) continue;
    line.days.add(day);
    if (c.source !== 'csv') line.csvOnly = false;

    if (c.direction === 'in') {
      line.inbound++;
      const hour = parseInt(hourFmt.format(when), 10);
      if (!line.byHour.has(hour)) line.byHour.set(hour, { total: 0, missed: 0 });
      const h = line.byHour.get(hour);
      h.total++;
      if (c.status === 'ANSWER') line.answered++;
      else { line.missed++; h.missed++; }
    } else {
      line.outbound++;
    }

    const key = axialysAgentKey(c.op_name);
    if (!key) continue;
    if (!agents.has(key)) agents.set(key, { in: 0, out: 0, comms: [], posts: [] });
    const a = agents.get(key);
    if (c.direction === 'in') a.in++; else a.out++;
    if (typeof c.duration_comm === 'number') a.comms.push(c.duration_comm);
    if (typeof c.post_appel === 'number') a.posts.push(c.post_appel);
  }

  const avg = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const perAgent = new Map();
  for (const [key, a] of agents) {
    perAgent.set(key, {
      in: a.in, out: a.out, total: a.in + a.out,
      commAvgSec: avg(a.comms), postAvgSec: avg(a.posts),
    });
  }

  // L'heure qui pèse le plus en manqués, pas celle au taux le plus haut : un
  // 100 % sur un seul appel de 9 h n'apprend rien.
  let worstHour = null;
  for (const [hour, h] of line.byHour) {
    if (h.missed && (!worstHour || h.missed > worstHour.missed)) worstHour = { hour, ...h };
  }

  return {
    agents: perAgent,
    line: {
      inbound: line.inbound,
      answered: line.answered,
      missed: line.missed,
      outbound: line.outbound,
      answerRate: line.inbound ? line.answered / line.inbound : null,
      worstHour,
      days: [...line.days].sort(),
      csvOnly: line.inbound + line.outbound > 0 && line.csvOnly,
    },
  };
}

/** Jours ouvrés (lun-ven) d'un mois — sert à repérer les journées non capturées. */
function workdaysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const days = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

const mean = (xs) => {
  const a = xs.filter(v => typeof v === 'number' && Number.isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
};

/**
 * Un rapport par technicien.
 *
 * La moyenne d'équipe ne compte que les techniciens actifs du mois : un
 * collègue en congés tout le mois tirerait la moyenne vers le bas et ferait
 * passer tout le monde pour performant. Les propriétaires RT hors liste
 * (renforts ponctuels, « Nobody ») n'y entrent pas non plus.
 */
function buildReports({ month, technicians, tickets, prevTickets, phone, prevPhone, firstMonth = null }) {
  // Avant le premier mois du rapport, les données ne sont pas comparables (pas
  // de notes de difficulté, téléphonie incomplète) : on ne compare pas.
  const hasPrevious = !firstMonth || shiftMonth(month, -1) >= firstMonth;
  const active = technicians.filter(t => tickets.get(t.id)?.resolved);
  const teamDelays = active.flatMap(t => tickets.get(t.id).delays);
  const team = {
    activeCount:   active.length,
    resolvedAvg:   mean(active.map(t => tickets.get(t.id).resolved)),
    medianHours:   median(teamDelays),
    sameDayPct:    mean(active.map(t => tickets.get(t.id).sameDayPct)),
    avgDifficulty: mean(active.map(t => tickets.get(t.id).avgDifficulty)),
    scoreAvg:      mean(active.map(t => tickets.get(t.id).score)),
  };

  const phoneAgents = technicians
    .map(t => t.axialys && phone.agents.get(axialysAgentKey(t.axialys)))
    .filter(a => a && a.total);
  const teamPhone = {
    activeCount:   phoneAgents.length,
    inAvg:         mean(phoneAgents.map(a => a.in)),
    outAvg:        mean(phoneAgents.map(a => a.out)),
    commAvgSec:    mean(phoneAgents.map(a => a.commAvgSec)),
  };

  return technicians.map((tech) => {
    const key = tech.axialys ? axialysAgentKey(tech.axialys) : null;
    const t = tickets.get(tech.id) || null;
    const p = key ? phone.agents.get(key) || null : null;
    return {
      month,
      prevMonth: shiftMonth(month, -1),
      hasPrevious,
      tech,
      tickets: t,
      prevTickets: hasPrevious ? prevTickets.get(tech.id) || null : null,
      team,
      phone: key ? {
        me: p,
        prev: hasPrevious ? prevPhone.agents.get(key) || null : null,
        team: teamPhone,
        line: phone.line,
        // Comptés sur les jours ouvrés seuls : un samedi avec appels ne doit
        // pas masquer un mardi perdu.
        missingWorkdays: workdaysInMonth(month).filter(d => !phone.line.days.includes(d)).length,
      } : null,
      // Rien à dire : pas de mail. Un rapport vide se lit comme un reproche.
      empty: !(t && (t.resolved || t.rejected)) && !(p && p.total),
    };
  });
}

// ─── Mise en forme ───────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fr1 = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const pct = (r) => (r === null || r === undefined ? '—' : `${Math.round(r * 100)} %`);

function fmtHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${fr1(Math.round(h * 10) / 10)} h`;
  return `${fr1(Math.round(h / 24 * 10) / 10)} j`;
}

function fmtSec(s) {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m} min ${String(r).padStart(2, '0')}` : `${r} s`;
}

/** « 12/09 » */
const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function delta(now, before) {
  if (!before) return null;
  const d = (now - before) / before;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${Math.abs(Math.round(d * 100))} %`;
}

const C = {
  ink: '#1f2937', muted: '#6b7280', line: '#e5e7eb', soft: '#f9fafb',
  brand: '#1e3a5f', accent: '#2563eb', good: '#047857', warn: '#b45309',
};

function kpi(label, value, sub) {
  return `<td valign="top" style="padding:12px 14px;border:1px solid ${C.line};background:#fff;width:33%">
    <div style="font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em">${esc(label)}</div>
    <div style="font-size:26px;font-weight:bold;color:${C.ink};margin:4px 0">${esc(value)}</div>
    <div style="font-size:12px;color:${C.muted};line-height:1.5">${sub}</div>
  </td>`;
}

function kpiRow(cells) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 -6px 10px">
    <tr>${cells.join('')}</tr></table>`;
}

function section(title, body) {
  return `<h2 style="font-size:17px;color:${C.brand};margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid ${C.brand}">${esc(title)}</h2>${body}`;
}

function notes(items) {
  if (!items.length) return '';
  return `<div style="background:${C.soft};border-left:3px solid ${C.accent};padding:10px 14px;margin:12px 0">
    <div style="font-weight:bold;font-size:13px;color:${C.ink};margin-bottom:4px">À retenir</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:${C.ink}">${items.map(i => `<li>${i}</li>`).join('')}</ul>
  </div>`;
}

function howTo(items) {
  // Pas de <details> : Outlook, client de l'équipe, ne le gère pas.
  return `<div style="font-size:12px;font-weight:bold;color:${C.muted};margin-top:10px">Comment lire ces chiffres</div>
    <ul style="margin:4px 0 0;padding-left:18px;font-size:12px;line-height:1.6;color:${C.muted}">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

function difficultyBars(dist) {
  const max = Math.max(...dist, 1);
  const labels = ['1 · simple', '2', '3', '4', '5 · complexe'];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:12px;color:${C.ink};margin:6px 0">
    ${dist.map((n, i) => `<tr>
      <td style="width:90px;padding:2px 8px 2px 0;color:${C.muted}">${labels[i]}</td>
      <td style="padding:2px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="${Math.max(2, Math.round(n / max * 100))}%"><tr><td style="background:${C.accent};height:12px;font-size:0;line-height:0">&nbsp;</td></tr></table></td>
      <td style="width:36px;padding:2px 0 2px 8px;text-align:right">${n}</td>
    </tr>`).join('')}
  </table>`;
}

/** « <br>août : … », ou rien du tout quand le mois précédent n'est pas comparable. */
function vsPrev(r, text) {
  return r.hasPrevious ? `<br>${MONTHS_FR[Number(r.prevMonth.slice(5)) - 1]} : ${text}` : '';
}

function ticketSection(r) {
  const t = r.tickets;
  const prevName = MONTHS_FR[Number(r.prevMonth.slice(5)) - 1];
  if (!t || !t.resolved) {
    return section('Tickets RT', `<p style="font-size:14px;color:${C.muted}">Aucun ticket résolu à votre nom ce mois-ci.</p>`);
  }
  const p = r.prevTickets;
  const team = r.team;

  const prevLine = vsPrev(r, p && p.resolved ? `${p.resolved} <b>(${delta(t.resolved, p.resolved)})</b>` : '—');
  const row1 = kpiRow([
    kpi('Tickets résolus', String(t.resolved),
      `Moyenne équipe : ${team.resolvedAvg === null ? '—' : Math.round(team.resolvedAvg)}${prevLine}`),
    kpi('Délai médian', fmtHours(t.medianHours),
      `Équipe : ${fmtHours(team.medianHours)}${vsPrev(r, fmtHours(p?.medianHours ?? null))}`),
    kpi('Résolus le jour même', pct(t.sameDayPct),
      `Équipe : ${pct(team.sameDayPct)}${vsPrev(r, pct(p?.sameDayPct ?? null))}`),
  ]);

  const row2 = kpiRow([
    kpi('Score', t.scored || t.bonus ? String(t.score) : '—',
      `Moyenne équipe : ${team.scoreAvg === null ? '—' : Math.round(team.scoreAvg)}<br>dont ${t.bonus} pt${t.bonus > 1 ? 's' : ''} de bonus urgence`),
    kpi('Difficulté moyenne', t.avgDifficulty === null ? '—' : fr1(Math.round(t.avgDifficulty * 10) / 10),
      `Équipe : ${team.avgDifficulty === null ? '—' : fr1(Math.round(team.avgDifficulty * 10) / 10)}<br>sur ${t.scored} ticket${t.scored > 1 ? 's' : ''} noté${t.scored > 1 ? 's' : ''}`),
    kpi('Tickets urgents', String(t.urgent), 'priorité 4 ou plus'),
  ]);

  const obs = [];
  if (p && p.resolved) {
    obs.push(`${t.resolved} tickets résolus contre ${p.resolved} en ${prevName}. Le volume dépend d'abord de ce qui arrive dans la file : il se lit avec le délai, jamais seul.`);
  }
  const unrated = t.resolved - t.scored;
  if (unrated > 0 && t.scored / t.resolved < 0.9) {
    obs.push(`<b>${unrated} ticket${unrated > 1 ? 's' : ''} résolu${unrated > 1 ? 's' : ''} sans note de difficulté.</b> Ils n'entrent pas dans le score : un ticket non noté n'est pas un ticket facile, c'est un travail qui ne se voit pas. Renseignez le champ <i>Difficulté</i> à la clôture.`);
  }
  if (t.medianHours !== null && team.medianHours !== null && t.resolved >= 5) {
    if (t.medianHours > team.medianHours * 1.5) {
      const harder = t.avgDifficulty !== null && team.avgDifficulty !== null && t.avgDifficulty > team.avgDifficulty + 0.2;
      obs.push(harder
        ? `Votre délai médian est au-dessus de celui de l'équipe, mais vos tickets sont aussi plus difficiles en moyenne : les deux vont ensemble.`
        : `Votre délai médian est au-dessus de celui de l'équipe. Un ticket en attente d'un retour utilisateur compte dans ce délai : pensez à relancer, ou à clore quand la demande est traitée.`);
    } else if (t.medianHours < team.medianHours * 0.8) {
      obs.push(`Vos tickets se résolvent plus vite que la médiane de l'équipe.`);
    }
  }
  if (t.urgent) {
    obs.push(`${t.urgent} ticket${t.urgent > 1 ? 's' : ''} urgent${t.urgent > 1 ? 's' : ''} pris en charge, soit ${t.bonus} point${t.bonus > 1 ? 's' : ''} de bonus — un bloquant compte même quand il est simple à régler.`);
  }
  if (t.bestDay && t.bestDay.count >= 3) {
    obs.push(`Meilleure journée : ${t.bestDay.count} tickets le ${fmtDay(t.bestDay.date)}.`);
  }

  const queues = Object.entries(t.byQueue).sort((a, b) => b[1] - a[1])
    .map(([q, n]) => `${esc(q)} : ${n}`).join(' · ');

  return section('Tickets RT', `
    ${row1}${row2}
    ${t.scored ? `<div style="font-size:13px;font-weight:bold;color:${C.ink};margin-top:14px">Vos tickets notés, par difficulté</div>${difficultyBars(t.difficulty)}` : ''}
    <div style="font-size:12px;color:${C.muted}">Par file : ${queues}</div>
    ${notes(obs)}
    ${howTo([
      '<b>Délai médian</b> : la moitié de vos tickets ont été résolus en moins de ce temps, de la création à la résolution, nuits et week-ends compris. On prend la médiane et non la moyenne pour qu\'un ticket resté bloqué trois semaines ne fausse pas tout le mois.',
      '<b>Résolus le jour même</b> : part des tickets créés et résolus dans la même journée — l\'indicateur des demandes réglées « à chaud ».',
      '<b>Score</b> : somme des notes de difficulté (1 à 5) des tickets notés, plus 1 point par ticket de priorité 4 et 2 points en priorité 5. Il valorise la difficulté, là où le nombre de tickets valorise le volume.',
      '<b>Moyenne équipe</b> : calculée sur les techniciens qui ont résolu au moins un ticket ce mois-ci. Les tickets rejetés (spam, mauvaise file) ne comptent nulle part.',
    ])}`);
}

function phoneSection(r) {
  const ph = r.phone;
  if (!ph) return '';
  const line = ph.line;

  if (!line.inbound && !line.outbound) {
    return section('Téléphonie', `<p style="font-size:14px;color:${C.muted}">Aucun appel enregistré pour la ligne du support ce mois-ci : la donnée est indisponible, ce n'est pas un mois sans appel.</p>`);
  }

  const me = ph.me || { in: 0, out: 0, total: 0, commAvgSec: null, postAvgSec: null };
  const prev = ph.prev;
  const team = ph.team;

  const row = kpiRow([
    kpi('Appels décrochés', String(me.in),
      `Moyenne équipe : ${team.inAvg === null ? '—' : Math.round(team.inAvg)}${vsPrev(r, prev ? prev.in : '—')}`),
    kpi('Appels passés', String(me.out),
      `Moyenne équipe : ${team.outAvg === null ? '—' : Math.round(team.outAvg)}${vsPrev(r, prev ? prev.out : '—')}`),
    kpi('Durée moyenne d\'un échange', fmtSec(me.commAvgSec),
      `Équipe : ${fmtSec(team.commAvgSec)}${vsPrev(r, fmtSec(prev?.commAvgSec ?? null))}`),
  ]);

  const obs = [];
  // Rapporté à toute la ligne et non aux seuls destinataires du rapport :
  // d'autres agents décrochent aussi, les ignorer gonflerait la part.
  if (me.in && line.answered) {
    obs.push(`Vous avez décroché <b>${pct(me.in / line.answered)}</b> des appels décrochés sur la ligne ce mois-ci.`);
  }
  if (me.postAvgSec !== null) {
    obs.push(`Temps de post-appel moyen : ${fmtSec(me.postAvgSec)}. C'est le temps passé après avoir raccroché, pendant lequel la ligne ne vous présente pas de nouvel appel.`);
  }

  const worst = line.worstHour;
  const lineBody = `
    <div style="font-size:13px;font-weight:bold;color:${C.ink};margin-top:14px">La ligne du support, toute l'équipe confondue</div>
    <p style="font-size:13px;line-height:1.6;color:${C.ink};margin:6px 0">
      ${line.inbound} appels entrants, <b>${pct(line.answerRate)} décrochés</b>, ${line.missed} manqués.
      ${worst ? `C'est à <b>${worst.hour} h</b> que l'équipe en a manqué le plus : ${worst.missed} sur ${worst.total}.` : ''}
    </p>`;

  const gaps = ph.missingWorkdays;
  const quality = [];
  // Un jour ouvré sans un seul appel n'arrive pas sur cette ligne : c'est une
  // journée que l'ingestion n'a pas capturée (voir CLAUDE.md, Téléphonie).
  if (gaps) quality.push(`${gaps} jour${gaps > 1 ? 's' : ''} ouvré${gaps > 1 ? 's' : ''} sans aucun appel enregistré : des journées n'ont pas été capturées, les chiffres sont donc un minimum.`);
  if (line.csvOnly) quality.push('Mois rattrapé depuis un export du portail Axialys : pas de temps de post-appel disponible.');

  return section('Téléphonie', `
    ${row}
    ${lineBody}
    ${notes(obs)}
    ${quality.length ? `<p style="font-size:12px;color:${C.warn};margin:6px 0">${quality.join(' ')}</p>` : ''}
    ${howTo([
      '<b>Un appel manqué n\'est attribué à personne</b> : il arrive quand aucun agent n\'est disponible au moment où il sonne. C\'est un résultat d\'équipe, d\'où sa place ici plutôt que dans vos chiffres.',
      'Un agent <b>en pause dans Axialys n\'est jamais sollicité</b> : son poste ne sonne pas. Si toute l\'équipe est en pause au même moment, l\'appelant attend dans la file sans qu\'aucun poste sonne, puis raccroche.',
      '<b>Durée moyenne d\'un échange</b> : temps de conversation seul, sans l\'attente ni la sonnerie. Ni courte ni longue n\'est « bien » : elle dépend de ce qu\'on vous demande.',
    ])}`);
}

function renderReportHtml(r) {
  const first = r.tech.firstName || r.tech.label;
  const label = monthLabel(r.month);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Votre mois de ${esc(label)}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:6px;overflow:hidden">
  <tr><td style="background:${C.brand};color:#fff;padding:20px 24px">
    <div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.06em">Support IT · rapport mensuel</div>
    <div style="font-size:22px;font-weight:bold;margin-top:4px">Votre mois de ${esc(label)}</div>
  </td></tr>
  <tr><td style="padding:20px 24px 28px">
    <p style="font-size:14px;line-height:1.6;margin:0">Bonjour ${esc(first)},</p>
    <p style="font-size:14px;line-height:1.6;margin:10px 0 0">Voici vos chiffres du mois dernier. Ils sont là pour vous aider à voir où vous en êtes, pas pour classer : chacun est comparé ${r.hasPrevious ? 'à votre mois précédent et ' : ''}à la moyenne de l'équipe, jamais à un collègue en particulier.${r.hasPrevious ? '' : ' C\'est le premier rapport : la comparaison avec le mois précédent apparaîtra à partir du prochain.'} Sous chaque bloc, quelques lignes expliquent ce que mesure chaque indicateur.</p>
    ${ticketSection(r)}
    ${phoneSection(r)}
    <p style="font-size:11px;color:${C.muted};line-height:1.6;margin-top:28px;border-top:1px solid ${C.line};padding-top:10px">
      Rapport automatique KaravundoBoard. Les notes de difficulté sont lues au moment de l'envoi : une note posée ensuite apparaîtra dans l'onglet Stats support, pas dans ce mail.
    </p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

/** Version texte, pour les clients qui n'affichent pas le HTML. */
function renderReportText(r) {
  const t = r.tickets;
  const lines = [`Bonjour ${r.tech.firstName || r.tech.label},`, '', `Vos chiffres de ${monthLabel(r.month)} :`, ''];
  if (t && t.resolved) {
    lines.push(
      `Tickets résolus : ${t.resolved} (moyenne équipe ${r.team.resolvedAvg === null ? '—' : Math.round(r.team.resolvedAvg)})`,
      `Délai médian : ${fmtHours(t.medianHours)} (équipe ${fmtHours(r.team.medianHours)})`,
      `Résolus le jour même : ${pct(t.sameDayPct)}`,
      `Score : ${t.score} — ${t.scored} tickets notés, ${t.urgent} urgents`,
    );
  } else {
    lines.push('Aucun ticket résolu ce mois-ci.');
  }
  if (r.phone && r.phone.me) {
    lines.push('', `Appels décrochés : ${r.phone.me.in}, passés : ${r.phone.me.out}`,
      `Ligne du support : ${r.phone.line.inbound} entrants, ${pct(r.phone.line.answerRate)} décrochés`);
  }
  lines.push('', 'La version complète, avec les explications, est dans la partie HTML de ce mail.');
  return lines.join('\n');
}

module.exports = {
  shiftMonth, monthLabel, localDate, isFirstWorkdayOfMonth,
  aggregateTickets, aggregateCalls, axialysAgentKey, workdaysInMonth,
  buildReports, renderReportHtml, renderReportText, fmtHours, fmtSec,
};
