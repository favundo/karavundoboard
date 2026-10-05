import { describe, expect, it } from 'vitest';
import {
  shiftMonth, isFirstWorkdayOfMonth, aggregateTickets, aggregateCalls,
  axialysAgentKey, buildReports, renderReportHtml,
} from '../../server/lib/monthlyReport.js';

const bonus = (p: number) => (p >= 5 ? 2 : p >= 4 ? 1 : 0);

describe('périodes', () => {
  it('décale les mois à travers l\'année', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('n\'envoie que le premier jour ouvré', () => {
    // 1er novembre 2026 : dimanche (et férié) → lundi 2.
    expect(isFirstWorkdayOfMonth('2026-11-01')).toBe(false);
    expect(isFirstWorkdayOfMonth('2026-11-02')).toBe(true);
    // 1er octobre 2026 : jeudi.
    expect(isFirstWorkdayOfMonth('2026-10-01')).toBe(true);
    expect(isFirstWorkdayOfMonth('2026-10-02')).toBe(false);
    // 1er janvier 2027 : vendredi férié → lundi 4.
    expect(isFirstWorkdayOfMonth('2027-01-01')).toBe(false);
    expect(isFirstWorkdayOfMonth('2027-01-04')).toBe(true);
  });
});

describe('aggregateTickets', () => {
  const rows = [
    { id: '1', Owner: 'nehad', Queue: 'sos', Status: 'resolved', Created: '2026-09-02 09:00', Resolved: '2026-09-02 11:00', Priority: '5' },
    { id: '2', Owner: 'nehad', Queue: 'sos-agences', Status: 'resolved', Created: '2026-09-01 09:00', Resolved: '2026-09-03 09:00', Priority: '0' },
    { id: '3', Owner: 'nehad', Queue: 'sos', Status: 'rejected', Created: '2026-09-04 09:00', Resolved: '2026-09-04 09:05', Priority: '0' },
    // Hors mois : la requête RT déborde volontairement d'un jour.
    { id: '4', Owner: 'nehad', Queue: 'sos', Status: 'resolved', Created: '2026-08-31 09:00', Resolved: '2026-08-31 10:00', Priority: '0' },
  ];
  const difficulty = new Map([['1', 4], ['4', 2]]);

  it('ne compte que le mois, et pas les rejets comme du travail', () => {
    const n = aggregateTickets(rows, difficulty, '2026-09', bonus).get('nehad');
    expect(n.resolved).toBe(2);
    expect(n.rejected).toBe(1);
    expect(n.byQueue).toEqual({ sos: 1, 'sos-agences': 1 });
  });

  it('laisse les tickets non notés hors score et hors difficulté moyenne', () => {
    const n = aggregateTickets(rows, difficulty, '2026-09', bonus).get('nehad');
    expect(n.scored).toBe(1);
    expect(n.avgDifficulty).toBe(4);
    expect(n.score).toBe(4 + 2);   // note 4 + bonus priorité 5
    expect(n.urgent).toBe(1);
  });

  it('mesure le délai et le jour même', () => {
    const n = aggregateTickets(rows, difficulty, '2026-09', bonus).get('nehad');
    expect(n.medianHours).toBe((2 + 48) / 2);
    expect(n.sameDayPct).toBe(0.5);
  });
});

describe('aggregateCalls', () => {
  const calls = [
    { direction: 'in', call_date: '2026-09-01T11:10:00Z', status: 'ANSWER', op_name: 'Abdelrahim TSI', duration_comm: 120, post_appel: 30, source: 'api' },
    { direction: 'in', call_date: '2026-09-01T11:20:00Z', status: 'ABORT', op_name: null, duration_comm: null, post_appel: null, source: 'api' },
    { direction: 'out', call_date: '2026-09-01T12:00:00Z', status: 'ANSWER', op_name: 'Abdelrahim TSI', duration_comm: 60, post_appel: null, source: 'api' },
    // 31/08 23h30 UTC = 01/09 01h30 à Paris : appartient à septembre.
    { direction: 'in', call_date: '2026-08-31T23:30:00Z', status: 'ANSWER', op_name: 'Rémy TSI', duration_comm: 10, post_appel: null, source: 'csv' },
  ];

  it('découpe le mois en heure de Paris', () => {
    const { line } = aggregateCalls(calls, '2026-09', 'Europe/Paris');
    expect(line.inbound).toBe(3);
    expect(line.days).toEqual(['2026-09-01']);
  });

  it('n\'attribue un appel manqué à personne', () => {
    const { agents, line } = aggregateCalls(calls, '2026-09', 'Europe/Paris');
    expect(line.missed).toBe(1);
    expect(agents.get('abdelrahim')).toMatchObject({ in: 1, out: 1, commAvgSec: 90, postAvgSec: 30 });
    expect(line.worstHour).toMatchObject({ hour: 13, missed: 1, total: 2 });
  });

  it('rapproche le prénom Axialys sans accent ni équipe', () => {
    expect(axialysAgentKey('Rémy TSI')).toBe('remy');
    expect(axialysAgentKey('Remy')).toBe('remy');
    expect(axialysAgentKey('')).toBeNull();
  });
});

describe('buildReports', () => {
  const techs = [
    { id: 'nehad', label: 'Nehad', email: 'n@karavel.com', axialys: 'Abdelrahim' },
    { id: 'maabid', label: 'M. Abid', email: 'm@karavel.com', axialys: 'Mahran' },
    { id: 'blouis', label: 'B. Louis', email: 'b@karavel.com' },
  ];
  const t = (resolved: number) => ({
    resolved, rejected: 0, byQueue: { sos: resolved }, medianHours: 4, sameDayPct: 0.5,
    scored: 0, avgDifficulty: null, difficulty: [0, 0, 0, 0, 0], score: 0, bonus: 0, urgent: 0,
    bestDay: null, delays: [4],
  });
  const noCalls = aggregateCalls([], '2026-09', 'Europe/Paris');

  it('fait la moyenne d\'équipe sur les seuls actifs, et ne rapporte rien à qui n\'a rien fait', () => {
    const reports = buildReports({
      month: '2026-09', technicians: techs,
      tickets: new Map([['nehad', t(100)], ['maabid', t(50)], ['Nobody', t(40)]]),
      prevTickets: new Map(), phone: noCalls, prevPhone: noCalls,
    });
    expect(reports[0].team.resolvedAvg).toBe(75);
    expect(reports[2].empty).toBe(true);
    expect(reports[2].phone).toBeNull();
  });

  it('ne compare pas au mois précédent le premier mois du rapport', () => {
    const args = {
      technicians: techs, tickets: new Map([['nehad', t(10)]]),
      prevTickets: new Map([['nehad', t(99)]]), phone: noCalls, prevPhone: noCalls,
      firstMonth: '2026-09',
    };
    const [first] = buildReports({ ...args, month: '2026-09' });
    expect(first.prevTickets).toBeNull();
    expect(renderReportHtml(first)).not.toContain('août');
    const [next] = buildReports({ ...args, month: '2026-10' });
    expect(next.prevTickets.resolved).toBe(99);
    expect(renderReportHtml(next)).toContain('septembre : 99');
  });

  it('dit « donnée indisponible » plutôt que zéro appel quand la ligne est muette', () => {
    const [r] = buildReports({
      month: '2026-09', technicians: techs,
      tickets: new Map([['nehad', t(10)]]), prevTickets: new Map(), phone: noCalls, prevPhone: noCalls,
    });
    const html = renderReportHtml(r);
    expect(html).toContain('la donnée est indisponible');
    expect(html).not.toContain('Appels décrochés');
  });
});
