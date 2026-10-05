import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type AxialysAvailabilityHour } from '@/hooks/useAxialysStats';
import { type VizPalette } from '@/lib/vizColors';
import { CHART_MARGIN, CHART_Y_WIDTH } from './format';

/**
 * Agents réellement joignables, heure par heure, en bande alignée sous le
 * graphique « Couverture par heure ».
 *
 * La question qu'elle tranche : un créneau qui manque des appels, est-ce que
 * personne n'était prévu, que personne n'était connecté, ou que les connectés
 * étaient en pause ? Trois mesures dans la même unité (des agents), donc un
 * seul axe : la barre pleine = joignables, le segment pâle au-dessus = connectés
 * en pause (la barre entière = connectés), le trait pointillé = planning TSI.
 *
 * Encre neutre, pas les couleurs des appels : c'est du contexte posé sous le
 * graphique, pas une série de plus à comparer aux décrochés et aux manqués.
 */

interface Props {
  /** Une ligne par heure du graphique au-dessus, dans le même ordre. */
  data: AxialysAvailabilityHour[];
  palette: VizPalette;
  formatKey?: (key: string | number) => string;
  showPlanned: boolean;
  height?: number;
}

const PLANNED_STROKE = 'hsl(var(--foreground))';

const n1 = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AxialysAvailabilityHour }[];
  label?: string | number;
  formatKey: (k: string | number) => string;
  showPlanned: boolean;
}

const AvailabilityTooltip = ({ active, payload, label, formatKey, showPlanned }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-foreground">{formatKey(label ?? '')} — agents en moyenne</p>
      {showPlanned && <p className="text-xs text-muted-foreground">{n1(row.planned)} prévus au planning</p>}
      <p className="text-xs text-muted-foreground">{n1(row.connected)} connectés</p>
      <p className="text-xs font-medium text-foreground">{n1(row.reachable)} joignables</p>
      <p className="text-xs text-muted-foreground">{n1(row.paused)} en pause</p>
    </div>
  );
};

export const AvailabilityStrip = ({ data, palette, formatKey = String, showPlanned, height = 110 }: Props) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.axis, opacity: 0.8 }} aria-hidden />
        Joignables
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.axis, opacity: 0.3 }} aria-hidden />
        Connectés en pause
      </span>
      {showPlanned && (
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke={PLANNED_STROKE} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Prévus au planning
        </span>
      )}
    </div>
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis dataKey="hour" hide />
          <YAxis
            allowDecimals={false}
            width={CHART_Y_WIDTH}
            tick={{ fontSize: 11, fill: palette.axis }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: palette.grid, fillOpacity: 0.35 }}
            content={<AvailabilityTooltip formatKey={formatKey} showPlanned={showPlanned} />}
          />
          <Bar dataKey="reachable" stackId="a" fill={palette.axis} fillOpacity={0.8}
               stroke={palette.surface} strokeWidth={2} isAnimationActive={false} />
          <Bar dataKey="paused" stackId="a" fill={palette.axis} fillOpacity={0.3}
               stroke={palette.surface} strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          {showPlanned && (
            <Line dataKey="planned" type="linear" stroke={PLANNED_STROKE} strokeWidth={2}
                  strokeDasharray="4 3" dot={{ r: 3, fill: PLANNED_STROKE, strokeWidth: 0 }}
                  activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </div>
);
