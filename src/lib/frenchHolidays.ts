// Meeus/Jones/Butcher algorithm for Easter Sunday
const easterDate = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getFrenchHolidays = (year: number): Set<string> => {
  const easter = easterDate(year);
  return new Set([
    new Date(year, 0, 1),    // Jour de l'An
    new Date(year, 4, 1),    // Fête du Travail
    new Date(year, 4, 8),    // Victoire 1945
    new Date(year, 6, 14),   // Fête Nationale
    new Date(year, 7, 15),   // Assomption
    new Date(year, 10, 1),   // Toussaint
    new Date(year, 10, 11),  // Armistice
    new Date(year, 11, 25),  // Noël
    addDays(easter, 1),      // Lundi de Pâques
    addDays(easter, 39),     // Ascension
    addDays(easter, 50),     // Lundi de Pentecôte
  ].map(toKey));
};

export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !getFrenchHolidays(date.getFullYear()).has(
    toKey(date),
  );
};
