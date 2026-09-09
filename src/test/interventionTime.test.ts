import { describe, expect, it } from 'vitest';
import {
  byTechnician, formatMinutes, lastPeriods, periodOf, totalsByPeriod,
} from '@/lib/interventionTime';
import type { SupportAppointment } from '@/hooks/useSupportAppointments';

const rdv = (
  uid: string,
  date: string,
  duree: number,
  statut: SupportAppointment['statut'] = 'cloture',
): SupportAppointment => ({
  id: `${uid}-${date}`,
  uid_user: 'user', email_user: 'user@karavel.com',
  uid_technicien: uid,
  service: 'Compta', asset: 'UC00001',
  type_intervention: 'installation',
  date_rdv: date,
  duree_minutes: duree,
  statut,
  notes: null, rappel_envoye: false,
  created_at: date, updated_at: date,
});

// Semaine ISO 37 de 2026 : lundi 7 → dimanche 13 septembre.
const MONDAY_W37 = '2026-09-07T09:00:00.000Z';
const FRIDAY_W37 = '2026-09-11T14:00:00.000Z';
const MONDAY_W38 = '2026-09-14T09:00:00.000Z';

describe('periodOf', () => {
  it('rattache une date à sa semaine ISO', () => {
    const p = periodOf(new Date(MONDAY_W37), 'week');
    expect(p.key).toBe('2026-W37');
    expect(p.title).toBe('Semaine 37');
  });

  it('rattache une date à son mois', () => {
    const p = periodOf(new Date(FRIDAY_W37), 'month');
    expect(p.key).toBe('2026-09');
    expect(p.title).toBe('Septembre 2026');
  });

  it('sépare deux semaines consécutives', () => {
    expect(periodOf(new Date(MONDAY_W38), 'week').key).toBe('2026-W38');
  });
});

describe('lastPeriods', () => {
  it('renvoie les n dernières périodes, la plus récente en dernier', () => {
    const periods = lastPeriods('week', 4, new Date(MONDAY_W38));
    expect(periods.map((p) => p.key)).toEqual(['2026-W35', '2026-W36', '2026-W37', '2026-W38']);
  });
});

describe('totalsByPeriod', () => {
  const items = [
    rdv('maabid', MONDAY_W37, 90),
    rdv('nehad', FRIDAY_W37, 60, 'planifie'),
    rdv('maabid', MONDAY_W38, 120),
  ];

  it('sépare le temps clôturé du temps encore planifié', () => {
    const periods = lastPeriods('week', 2, new Date(MONDAY_W38));
    const totals = totalsByPeriod(items, periods, 'week');
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({ key: '2026-W37', closedH: 1.5, openH: 1, totalH: 2.5, count: 2 });
    expect(totals[1]).toMatchObject({ key: '2026-W38', closedH: 2, openH: 0, count: 1 });
  });

  it('ignore ce qui tombe hors de la fenêtre affichée', () => {
    const periods = lastPeriods('week', 1, new Date(MONDAY_W38));
    const totals = totalsByPeriod(items, periods, 'week');
    expect(totals[0].count).toBe(1);
  });

  it('regroupe tout le mois quand la granularité est mensuelle', () => {
    const periods = lastPeriods('month', 1, new Date(FRIDAY_W37));
    const totals = totalsByPeriod(items, periods, 'month');
    expect(totals[0]).toMatchObject({ key: '2026-09', totalH: 4.5, count: 3 });
  });
});

describe('byTechnician', () => {
  const week37 = periodOf(new Date(MONDAY_W37), 'week');
  const now = new Date('2026-09-12T10:00:00.000Z');   // vendredi soir de la S37

  it('trie par temps total décroissant et calcule la moyenne', () => {
    const rows = byTechnician(
      [
        rdv('nehad', MONDAY_W37, 30),
        rdv('maabid', MONDAY_W37, 90),
        rdv('maabid', FRIDAY_W37, 30),
      ],
      week37,
      now,
    );
    expect(rows.map((r) => r.uid)).toEqual(['maabid', 'nehad']);
    expect(rows[0]).toMatchObject({ totalMin: 120, count: 2, avgMin: 60 });
  });

  it('compte comme « à clôturer » une intervention passée encore planifiée', () => {
    const rows = byTechnician(
      [
        rdv('nehad', MONDAY_W37, 60, 'planifie'),   // passée au regard de `now`
        rdv('nehad', '2026-09-13T09:00:00.000Z', 60, 'planifie'), // encore à venir
      ],
      week37,
      now,
    );
    expect(rows[0]).toMatchObject({ totalMin: 120, closedMin: 0, openMin: 120, lateCount: 1 });
  });

  it('exclut ce qui est hors période', () => {
    const rows = byTechnician([rdv('nehad', MONDAY_W38, 60)], week37, now);
    expect(rows).toEqual([]);
  });
});

describe('formatMinutes', () => {
  it('formate en heures et minutes', () => {
    expect(formatMinutes(450)).toBe('7 h 30');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('rend un tiret plutôt qu\'un zéro', () => {
    expect(formatMinutes(0)).toBe('—');
    expect(formatMinutes(null)).toBe('—');
  });
});
