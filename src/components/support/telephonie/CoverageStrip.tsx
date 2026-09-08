import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type AxialysCoverageDay } from '@/hooks/useAxialysStats';
import { type VizPalette } from '@/lib/vizColors';
import { CHART_MARGIN, CHART_Y_WIDTH } from './format';

/**
 * Effectif TSI planifié, en bande alignée sous le graphique des appels.
 *
 * POURQUOI UNE BANDE SÉPARÉE ET NON UNE COURBE SUPERPOSÉE : les appels vont de
 * 0 à 31, les techniciens de 0 à 5. Les mettre sur un même graphique
 * imposerait deux échelles verticales, et deux échelles font lire un rapport
 * entre les deux séries qui n'existe pas — la courbe paraît « suivre » ou
 * « décrocher » selon l'échelle choisie, pas selon les données. Deux
 * graphiques empilés partageant l'axe des dates disent la même chose sans
 * mentir sur les proportions.
 *
 * La bande est en encre neutre, pas dans les couleurs des séries d'appels :
 * c'est du contexte, pas une troisième catégorie à comparer aux deux autres.
 */

interface Props {
  data: AxialysCoverageDay[];
  palette: VizPalette;
  formatKey?: (key: string | number) => string;
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AxialysCoverageDay }[];
  label?: string | number;
  formatKey: (k: string | number) => string;
}

const CoverageTooltip = ({ active, payload, label, formatKey }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-foreground">{formatKey(label ?? '')}</p>
      <p className="text-xs text-muted-foreground">
        {row.techs} technicien{row.techs > 1 ? 's' : ''} planifié{row.techs > 1 ? 's' : ''}
      </p>
      <p className="text-xs text-muted-foreground">{row.techHours} h de présence prévue</p>
    </div>
  );
};

export const CoverageStrip = ({ data, palette, formatKey = String, height = 80 }: Props) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis dataKey="day" hide />
        <YAxis
          allowDecimals={false}
          width={CHART_Y_WIDTH}
          tick={{ fontSize: 11, fill: palette.axis }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: palette.grid, fillOpacity: 0.35 }}
          content={<CoverageTooltip formatKey={formatKey} />}
        />
        <Bar dataKey="techs" fill={palette.axis} fillOpacity={0.55}
             stroke={palette.surface} strokeWidth={2} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);
