/**
 * Palette data-viz du dashboard — validée (séparation daltonienne + contraste
 * sur la surface) pour le thème clair ET le thème sombre. Les deux thèmes ont
 * leurs propres valeurs : ce n'est pas une inversion automatique.
 *
 * Deux séries seulement sur les graphiques de flux : « résolus » (bleu) et
 * « créés » (orange) — la paire passe tous les contrôles avec une marge large.
 * Les magnitudes (classement, heatmap) utilisent une rampe d'une seule teinte.
 */
export interface VizPalette {
  resolved: string;
  created: string;
  grid: string;
  axis: string;
  surface: string;
  /** Rampe séquentielle 5 pas, du plus faible au plus fort. */
  heat: string[];
}

export const VIZ: Record<'light' | 'dark', VizPalette> = {
  light: {
    resolved: '#2a78d6',
    created:  '#eb6834',
    grid:     'hsl(212 26% 88%)',
    axis:     'hsl(215 16% 47%)',
    surface:  'hsl(210 40% 98%)',
    heat:     ['#eaf1fa', '#c5daf2', '#94bce7', '#5b98da', '#2a78d6'],
  },
  dark: {
    resolved: '#3987e5',
    created:  '#d95926',
    grid:     'hsl(215 19% 28%)',
    axis:     'hsl(215 20% 65%)',
    surface:  'hsl(217 32% 17%)',
    heat:     ['#243347', '#274a70', '#2a629b', '#317bc9', '#5b9df0'],
  },
};

/** Couleur de la rampe séquentielle pour une valeur rapportée à un max. */
export function heatColor(value: number, max: number, palette: VizPalette): string {
  if (value <= 0 || max <= 0) return 'transparent';
  const steps = palette.heat;
  const idx = Math.min(steps.length - 1, Math.floor((value / max) * steps.length));
  return steps[idx];
}
