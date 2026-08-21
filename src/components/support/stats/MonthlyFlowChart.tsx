import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type RTMonthStats } from '@/hooks/useRTStats';
import { MONTH_LABELS } from './format';
import { type VizPalette } from '@/lib/vizColors';

interface Props {
  months: RTMonthStats[];
  palette: VizPalette;
}

const Legend = ({ palette }: { palette: VizPalette }) => (
  <div className="flex items-center gap-4 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.resolved }} aria-hidden />
      Résolus
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: palette.created }} aria-hidden />
      Créés
    </span>
  </div>
);

interface FlowTooltipProps {
  active?: boolean;
  payload?: { payload: RTMonthStats }[];
  label?: string;
  palette: VizPalette;
}

const FlowTooltip = ({ active, payload, label, palette }: FlowTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const ratio = row.created ? Math.round((row.resolved / row.created) * 100) : null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: palette.resolved }} />
        {row.resolved} résolus
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: palette.created }} />
        {row.created} créés
      </p>
      {ratio !== null && (
        <p className="mt-1 border-t border-border pt-1 text-xs font-medium text-foreground">
          Absorption {ratio} %
        </p>
      )}
    </div>
  );
};

/**
 * Flux entrant / sortant de la file. Les deux séries comptent des tickets :
 * un seul axe, jamais deux échelles.
 */
export const MonthlyFlowChart = ({ months, palette }: Props) => {
  // Les mois à venir ne sont pas « zéro ticket », ils n'existent pas encore.
  const data = months
    .filter((m) => m.created > 0 || m.resolved > 0)
    .map((m) => ({ ...m, label: MONTH_LABELS[Number(m.month.slice(5)) - 1] ?? m.month }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Entrées / sorties par mois
        </h3>
        <Legend palette={palette} />
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={palette.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.axis }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.axis }} width={44} />
            <Tooltip content={<FlowTooltip palette={palette} />} cursor={{ fill: palette.grid, fillOpacity: 0.25 }} />
            <Bar dataKey="resolved" name="Résolus" fill={palette.resolved} radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Line
              type="monotone"
              dataKey="created"
              name="Créés"
              stroke={palette.created}
              strokeWidth={2}
              dot={{ r: 4, fill: palette.created, stroke: palette.surface, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
