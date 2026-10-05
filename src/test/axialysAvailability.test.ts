import { describe, expect, it } from 'vitest';
import { normalizeStatusRow, splitByHour, hourlyAvailability } from '../../server/lib/axialysAvailability.js';

const TZ = 'Europe/Paris';

describe('normalizeStatusRow', () => {
  it('garde login et break, avec le code de motif sur la pause seulement', () => {
    expect(normalizeStatusRow(
      { id_op: 21116, duration: 2379, date: '2026-10-05T08:02:21Z', id_call: null, infos: 'user0', type: 'break' },
      '2026-10-05',
    )).toEqual({
      id_op: 21116, type: 'break', started_at: '2026-10-05T08:02:21.000Z',
      duration: 2379, infos: 'user0', day: '2026-10-05',
    });
    expect(normalizeStatusRow(
      { id_op: 22238, duration: 25234, date: '2026-10-04T23:00:12Z', infos: 'manu', type: 'login' },
      '2026-10-05',
    )?.infos).toBeNull();
  });

  it('écarte les appels et le post-appel, déjà ailleurs ou sans intérêt', () => {
    for (const type of ['call_in', 'call_out', 'catchup']) {
      expect(normalizeStatusRow({ id_op: 1, duration: 4, date: '2026-10-05T08:00:00Z', type }, '2026-10-05')).toBeNull();
    }
  });

  it('écarte une ligne sans date ou sans agent', () => {
    expect(normalizeStatusRow({ id_op: 1, duration: 4, type: 'break' }, 'x')).toBeNull();
    expect(normalizeStatusRow({ duration: 4, date: '2026-10-05T08:00:00Z', type: 'break' }, 'x')).toBeNull();
  });
});

describe('splitByHour', () => {
  it('répartit une durée sur les heures locales qu\'elle traverse', () => {
    // 08:30Z = 10:30 à Paris (heure d'été), 90 min → 30 min à 10 h, 60 min à 11 h
    expect(splitByHour('2026-10-05T08:30:00Z', 5400, TZ)).toEqual([
      { day: '2026-10-05', hour: 10, sec: 1800 },
      { day: '2026-10-05', hour: 11, sec: 3600 },
    ]);
  });

  it('rattache minuit UTC-2 au bon jour local', () => {
    expect(splitByHour('2026-10-04T22:00:00Z', 60, TZ)).toEqual([{ day: '2026-10-05', hour: 0, sec: 60 }]);
  });
});

describe('hourlyAvailability', () => {
  // Une journée : deux agents connectés 9 h → 17 h (07:00Z → 15:00Z),
  // l'un en pause déjeuner 13 h → 14 h.
  const rows = [
    { type: 'login', started_at: '2026-10-02T07:00:00Z', duration: 8 * 3600 },
    { type: 'login', started_at: '2026-10-02T07:00:00Z', duration: 8 * 3600 },
    { type: 'break', started_at: '2026-10-02T11:00:00Z', duration: 3600 },
  ];

  it('soustrait les pauses : connecté n\'est pas joignable', () => {
    const r = hourlyAvailability({ rows, statusDays: ['2026-10-02'], tz: TZ });
    expect(r.byHour[10]).toMatchObject({ connected: 2, reachable: 2, paused: 0 });
    expect(r.byHour[13]).toMatchObject({ connected: 2, reachable: 1, paused: 1 });
    expect(r.byHour[17]).toMatchObject({ connected: 0, reachable: 0 });
  });

  it('moyenne sur les jours relevés, pas sur les jours qui ont des lignes', () => {
    // Le 03 a été relevé et n'a vu personne : c'est un vrai zéro, il compte.
    const r = hourlyAvailability({ rows, statusDays: ['2026-10-02', '2026-10-03'], tz: TZ });
    expect(r.days).toBe(2);
    expect(r.byHour[10].connected).toBe(1);
  });

  it('ignore les lignes d\'un jour non relevé', () => {
    const r = hourlyAvailability({ rows, statusDays: ['2026-10-03'], tz: TZ });
    expect(r.byHour[10].connected).toBe(0);
  });

  it('compte le planning au prorata : un créneau finissant à 17h30 vaut ½ à 17 h', () => {
    const r = hourlyAvailability({
      rows, statusDays: ['2026-10-02'], tz: TZ,
      shifts: [{ day: '2026-10-02', start: 9, end: 17.5 }, { day: '2026-10-02', start: 9, end: 18 }],
      plannedDays: ['2026-10-02'],
    });
    expect(r.byHour[16].planned).toBe(2);
    expect(r.byHour[17].planned).toBe(1.5);
    expect(r.byHour[18].planned).toBe(0);
  });

  it('rend « prévu » null quand le planning ne couvre aucun jour relevé', () => {
    const r = hourlyAvailability({
      rows, statusDays: ['2026-10-02'], tz: TZ,
      shifts: [{ day: '2026-09-01', start: 9, end: 17 }], plannedDays: ['2026-09-01'],
    });
    expect(r.plannedDays).toBe(0);
    expect(r.byHour[10].planned).toBeNull();
  });

  it('ne rend jamais une disponibilité négative', () => {
    const r = hourlyAvailability({
      rows: [{ type: 'break', started_at: '2026-10-02T11:00:00Z', duration: 3600 }],
      statusDays: ['2026-10-02'], tz: TZ,
    });
    expect(r.byHour[13]).toMatchObject({ connected: 0, reachable: 0, paused: 0 });
  });
});
