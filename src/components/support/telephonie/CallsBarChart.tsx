import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type AxialysBucket } from '@/hooks/useAxialysStats';
import { type VizPalette } from '@/lib/vizColors';
import { CHART_MARGIN, CHART_Y_WIDTH } from './format';

/**
 * Volume d'appels entrants sur un axe ordonné (heure, jour, jour de semaine),
 * empilé en décrochés / manqués.
 *
 * L'empilement plutôt que deux barres côte à côte, ou qu'un simple taux : la
 * hauteur totale porte le volume et le segment porte le manque, si bien qu'on
 * lit les deux d'un coup. Un taux seul mettrait sur le même plan un créneau à
 * 74 % de manqués sur 31 appels et un créneau à 74 % sur 4 appels — le premier
 * mérite une décision, le second est du bruit.
 *
 * Couleurs : la paire validée du projet (src/lib/vizColors.ts), vérifiée sur
 * les deux thèmes — séparation daltonienne ΔE 24,7 en clair et 26,8 en sombre,
 * contraste sur la surface au-dessus de 3:1.
 */

interface Props {
  data: AxialysBucket[];
  palette: VizPalette;
  /** Mise en forme de l'abscisse : « 9 » → « 9h », « Mon » → « lun. ». */
  formatKey?: (key: string | number) => string;
  height?: number;
}

const Legend = ({ palette }: { palette: VizPalette }) => (
  <div className="flex items-center gap-4 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.resolved }} aria-hidden />
      Décrochés
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.created }} aria-hidden />
      Manqués
    </span>
  </div>
);

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AxialysBucket & { missed: number } }[];
  label?: string | number;
  palette: VizPalette;
  formatKey: (k: string | number) => string;
}

const CallsTooltip = ({ active, payload, label, palette, formatKey }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const rate = row.total > 0 ? Math.round((row.missed / row.total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-foreground">
        {formatKey(label ?? '')} — {row.total} appel{row.total > 1 ? 's' : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: palette.resolved }} />
        {row.answered} décrochés
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: palette.created }} />
        {row.missed} manqués ({rate} %)
      </p>
    </div>
  );
};

export const CallsBarChart = ({ data, palette, formatKey = String, height = 220 }: Props) => {
  const rows = data.map((b) => ({ ...b, missed: b.total - b.answered }));

  return (
    <div className="space-y-2">
      <Legend palette={palette} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} stroke={palette.grid} />
            <XAxis
              dataKey="key"
              tickFormatter={formatKey}
              tick={{ fontSize: 11, fill: palette.axis }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              width={CHART_Y_WIDTH}
              tick={{ fontSize: 11, fill: palette.axis }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: palette.grid, fillOpacity: 0.35 }}
              content={<CallsTooltip palette={palette} formatKey={formatKey} />}
            />
            {/* Le liseré à la couleur de la surface crée les 2 px d'écart entre
                les deux segments empilés : sans lui ils se touchent et la
                frontière devient illisible sur les petites valeurs. */}
            <Bar dataKey="answered" stackId="a" fill={palette.resolved}
                 stroke={palette.surface} strokeWidth={2} />
            <Bar dataKey="missed" stackId="a" fill={palette.created}
                 stroke={palette.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
