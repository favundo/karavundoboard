/**
 * Temps d'intervention par technicien, à partir du planning support IT.
 *
 * La donnée agrégée ici est `duree_minutes` : la durée *approximative saisie à
 * la prise de rendez-vous*, par pas de 30 minutes — pas un temps mesuré. La
 * clôture d'une intervention n'enregistre aucune durée réelle. C'est donc une
 * mesure de charge planifiée, et elle ne vaut que ce que vaut la saisie.
 *
 * Deux lectures sont donc toujours renvoyées côte à côte : ce qui est clôturé
 * (l'intervention a bien eu lieu) et ce qui ne l'est pas encore. Additionner
 * les deux sans les distinguer ferait passer un créneau réservé pour du travail
 * fait ; ne compter que les clôturées ferait disparaître du travail réellement
 * effectué mais jamais clôturé.
 */
import {
  addMonths, addWeeks, endOfISOWeek, endOfMonth, format,
  getISOWeek, getISOWeekYear, startOfISOWeek, startOfMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { SupportAppointment } from '@/hooks/useSupportAppointments';

export type Granularity = 'week' | 'month';

export interface Period {
  /** Clé de regroupement : « 2026-W37 » ou « 2026-09 ». */
  key: string;
  start: Date;
  /** Dernier instant de la période — bornes incluses des deux côtés. */
  end: Date;
  /** Étiquette courte, pour un axe de graphique : « S37 », « sept. ». */
  label: string;
  /** Intitulé long, pour l'en-tête du détail : « Semaine 37 ». */
  title: string;
  /** Précision de dates sous l'intitulé : « 8 → 14 sept. 2026 ». */
  range: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** La période (semaine ISO ou mois) qui contient cette date. */
export function periodOf(date: Date, gran: Granularity): Period {
  if (gran === 'week') {
    const start = startOfISOWeek(date);
    const end = endOfISOWeek(date);
    const week = getISOWeek(date);
    // L'année ISO, pas l'année civile : la semaine 1 peut commencer en décembre.
    const key = `${getISOWeekYear(date)}-W${String(week).padStart(2, '0')}`;
    const sameMonth = start.getMonth() === end.getMonth();
    return {
      key, start, end,
      label: `S${week}`,
      title: `Semaine ${week}`,
      range: sameMonth
        ? `${format(start, 'd', { locale: fr })} → ${format(end, 'd MMM yyyy', { locale: fr })}`
        : `${format(start, 'd MMM', { locale: fr })} → ${format(end, 'd MMM yyyy', { locale: fr })}`,
    };
  }
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    key: format(start, 'yyyy-MM'),
    start, end,
    label: format(start, 'MMM', { locale: fr }),
    title: cap(format(start, 'MMMM yyyy', { locale: fr })),
    range: `${format(end, 'd')} jours`,
  };
}

/** Même période décalée de `delta` crans (négatif = vers le passé). */
export const shiftPeriod = (period: Period, delta: number, gran: Granularity): Period =>
  periodOf(gran === 'week' ? addWeeks(period.start, delta) : addMonths(period.start, delta), gran);

/** Les `count` dernières périodes, la plus ancienne en tête, `ref` incluse. */
export function lastPeriods(gran: Granularity, count: number, ref: Date = new Date()): Period[] {
  const current = periodOf(ref, gran);
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, i - (count - 1), gran));
}

const minutesOf = (a: SupportAppointment) => a.duree_minutes ?? 0;
const isClosed = (a: SupportAppointment) => a.statut === 'cloture';

/** Les interventions d'une période, quel que soit leur statut. */
export const inPeriod = (items: SupportAppointment[], period: Period): SupportAppointment[] =>
  items.filter((a) => {
    const t = new Date(a.date_rdv).getTime();
    return t >= period.start.getTime() && t <= period.end.getTime();
  });

export interface PeriodTotals {
  key: string;
  label: string;
  title: string;
  /** Heures, pas minutes : c'est l'unité du graphique. */
  closedH: number;
  openH: number;
  totalH: number;
  count: number;
}

/** Une ligne par période, dans l'ordre reçu — le graphique d'évolution. */
export function totalsByPeriod(
  items: SupportAppointment[],
  periods: Period[],
  gran: Granularity,
): PeriodTotals[] {
  const buckets = new Map(periods.map((p) => [p.key, { closed: 0, open: 0, count: 0 }]));
  for (const a of items) {
    const key = periodOf(new Date(a.date_rdv), gran).key;
    const b = buckets.get(key);
    if (!b) continue;                       // hors de la fenêtre affichée
    b.count += 1;
    if (isClosed(a)) b.closed += minutesOf(a);
    else b.open += minutesOf(a);
  }
  return periods.map((p) => {
    const b = buckets.get(p.key)!;
    return {
      key: p.key,
      label: p.label,
      title: p.title,
      closedH: b.closed / 60,
      openH: b.open / 60,
      totalH: (b.closed + b.open) / 60,
      count: b.count,
    };
  });
}

export interface TechTime {
  uid: string;
  totalMin: number;
  closedMin: number;
  openMin: number;
  count: number;
  closedCount: number;
  /** Interventions passées jamais clôturées — l'explication d'un écart. */
  lateCount: number;
  avgMin: number | null;
}

/**
 * Une ligne par technicien sur une période, triée par temps total décroissant.
 * `now` sert à repérer les interventions passées non clôturées ; le passer en
 * paramètre garde la fonction pure et donc testable.
 */
export function byTechnician(
  items: SupportAppointment[],
  period: Period,
  now: Date = new Date(),
): TechTime[] {
  const rows = new Map<string, TechTime>();
  for (const a of inPeriod(items, period)) {
    const uid = a.uid_technicien || 'Nobody';
    if (!rows.has(uid)) {
      rows.set(uid, { uid, totalMin: 0, closedMin: 0, openMin: 0, count: 0, closedCount: 0, lateCount: 0, avgMin: null });
    }
    const r = rows.get(uid)!;
    const mins = minutesOf(a);
    r.totalMin += mins;
    r.count += 1;
    if (isClosed(a)) {
      r.closedMin += mins;
      r.closedCount += 1;
    } else {
      r.openMin += mins;
      if (new Date(a.date_rdv).getTime() < now.getTime()) r.lateCount += 1;
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, avgMin: r.count ? Math.round(r.totalMin / r.count) : null }))
    .sort((a, b) => b.totalMin - a.totalMin || a.uid.localeCompare(b.uid));
}

/** 450 → « 7 h 30 » ; 45 → « 45 min » ; 0 → « — », jamais « 0 h ». */
export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
