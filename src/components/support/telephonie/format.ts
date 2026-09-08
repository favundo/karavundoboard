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

/**
 * Géométrie partagée par le graphique des appels et la bande d'effectif posée
 * dessous. Les deux DOIVENT utiliser les mêmes marges et la même largeur d'axe
 * vertical, sans quoi les colonnes ne tombent pas en face des dates et la
 * lecture croisée devient fausse — c'est tout l'intérêt de la bande.
 */
export const CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 } as const;
export const CHART_Y_WIDTH = 34;
