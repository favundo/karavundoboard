/**
 * Mise en forme des abscisses des graphiques téléphonie.
 *
 * Dans un fichier à part et non dans CallsBarChart : un module qui exporte à la
 * fois des composants et des fonctions casse le rafraîchissement à chaud de
 * Vite (react-refresh/only-export-components).
 */

const WEEKDAY_FR: Record<string, string> = {
  Mon: 'lun.', Tue: 'mar.', Wed: 'mer.', Thu: 'jeu.', Fri: 'ven.', Sat: 'sam.', Sun: 'dim.',
};

export const formatHourKey = (k: string | number) => `${k}h`;
export const formatWeekdayKey = (k: string | number) => WEEKDAY_FR[String(k)] ?? String(k);
/** '2026-09-07' → '07/09' */
export const formatDayKey = (k: string | number) => `${String(k).slice(8)}/${String(k).slice(5, 7)}`;
