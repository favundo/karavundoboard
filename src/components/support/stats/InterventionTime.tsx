import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Loader2, Timer } from 'lucide-react';
import { useAppointmentsSince } from '@/hooks/useSupportAppointments';
import { type VizPalette } from '@/lib/vizColors';
import {
  byTechnician, formatMinutes, type Granularity, lastPeriods,
  periodOf, type PeriodTotals, shiftPeriod, totalsByPeriod,
} from '@/lib/interventionTime';
import { ownerColor, ownerLabel } from './format';

/** Douze crans dans les deux granularités : un trimestre de semaines, une année de mois. */
const SPAN = 12;

interface Props {
  palette: VizPalette;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: PeriodTotals }[];
  palette: VizPalette;
}

const ChartTooltip = ({ active, payload, palette }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-foreground">{row.title}</p>
      {row.count === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune intervention</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: palette.resolved }} />
            {formatMinutes(row.closedH * 60)} clôturé
          </p>
          <p className="text-xs text-muted-foreground">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle"
              style={{ backgroundColor: palette.resolved, opacity: 0.35 }}
            />
            {formatMinutes(row.openH * 60)} non clôturé
          </p>
          <p className="mt-1 border-t border-border pt-1 text-xs font-medium text-foreground">
            {formatMinutes(row.totalH * 60)} sur {row.count} intervention{row.count > 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
};

/**
 * Temps d'intervention par technicien, tiré du planning support IT.
 *
 * Volontairement à la semaine ou au mois, jamais au jour : au jour le jour, la
 * mesure ne dit rien d'autre que le calendrier, qui est déjà consultable.
 */
export const InterventionTime = ({ palette }: Props) => {
  const [gran, setGran] = useState<Granularity>('week');
  const [offset, setOffset] = useState(0);         // 0 = période en cours, négatif = passé

  const periods = useMemo(() => lastPeriods(gran, SPAN), [gran]);

  // La fenêtre affichée borne la requête : douze semaines ou douze mois.
  const { data, isLoading, error } = useAppointmentsSince(periods[0].start.toISOString());
  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const totals = useMemo(() => totalsByPeriod(items, periods, gran), [items, periods, gran]);

  const selected = useMemo(
    () => shiftPeriod(periodOf(new Date(), gran), offset, gran),
    [gran, offset],
  );
  const rows = useMemo(() => byTechnician(items, selected), [items, selected]);

  const maxMin = rows.length ? rows[0].totalMin : 0;
  const totalMin = rows.reduce((s, r) => s + r.totalMin, 0);
  const closedMin = rows.reduce((s, r) => s + r.closedMin, 0);
  const count = rows.reduce((s, r) => s + r.count, 0);
  const late = rows.reduce((s, r) => s + r.lateCount, 0);
  const everAny = totals.some((t) => t.count > 0);

  const setGranularity = (g: Granularity) => {
    setGran(g);
    setOffset(0);                                  // un « S37 » n'a pas d'équivalent en mois
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">

      {/* En-tête : intitulé + bascule semaine / mois */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Timer size={14} />
            Temps d'intervention par technicien
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Planning des interventions support IT — indépendant des tickets RT ci-dessus.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Granularité">
          {([['week', 'Semaine'], ['month', 'Mois']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGranularity(value)}
              aria-pressed={gran === value}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                gran === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} />
          Chargement du planning…
        </div>
      )}

      {error && (
        <p className="py-8 text-sm text-muted-foreground">
          Planning indisponible — {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && (
        <>
          {/* Évolution : la question « est-ce que ça monte ou ça descend » */}
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totals} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={palette.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.axis }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 11, fill: palette.axis }}
                  tickFormatter={(v: number) => `${v} h`}
                />
                <Tooltip content={<ChartTooltip palette={palette} />} cursor={{ fill: palette.grid, fillOpacity: 0.25 }} />
                <Bar dataKey="closedH" stackId="h" name="Clôturé" fill={palette.resolved} maxBarSize={34} />
                <Bar
                  dataKey="openH"
                  stackId="h"
                  name="Non clôturé"
                  fill={palette.resolved}
                  fillOpacity={0.35}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={34}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.resolved }} aria-hidden />
              Clôturé
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: palette.resolved, opacity: 0.35 }}
                aria-hidden
              />
              Planifié, pas encore clôturé
            </span>
          </div>

          {/* Détail d'une période — celle en cours par défaut */}
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((o) => o - 1)}
                  aria-label="Période précédente"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="min-w-[190px] text-center">
                  <p className="text-sm font-semibold text-foreground">{selected.title}</p>
                  <p className="text-[11px] text-muted-foreground">{selected.range}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.min(0, o + 1))}
                  disabled={offset >= 0}
                  aria-label="Période suivante"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <b className="text-base font-semibold tabular-nums text-foreground">{formatMinutes(totalMin)}</b> au total
                </span>
                <span>
                  <b className="font-semibold tabular-nums text-foreground">{formatMinutes(closedMin)}</b> clôturé
                </span>
                <span>
                  <b className="font-semibold tabular-nums text-foreground">{count}</b> intervention{count > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {everAny
                  ? 'Aucune intervention planifiée sur cette période.'
                  : 'Aucune intervention dans le planning sur les douze dernières périodes.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Technicien</th>
                      <th className="px-2 py-2 font-medium">Répartition</th>
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-2 py-2 text-right font-medium">Dont clôturé</th>
                      <th className="px-2 py-2 text-right font-medium">Interventions</th>
                      <th className="px-2 py-2 text-right font-medium">Durée moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const color = ownerColor(r.uid);
                      const width = maxMin ? (r.totalMin / maxMin) * 100 : 0;
                      const closedShare = r.totalMin ? (r.closedMin / r.totalMin) * 100 : 0;
                      return (
                        <tr key={r.uid} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                              <span className="text-foreground">{ownerLabel(r.uid)}</span>
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {/* Barre pleine = clôturé, barre pâle = encore ouvert. */}
                            <div
                              className="flex h-2.5 min-w-[60px] overflow-hidden rounded-sm bg-muted"
                              style={{ width: `${Math.max(width, 4)}%` }}
                              title={`${formatMinutes(r.closedMin)} clôturé sur ${formatMinutes(r.totalMin)}`}
                            >
                              <span style={{ width: `${closedShare}%`, backgroundColor: color }} />
                              <span style={{ width: `${100 - closedShare}%`, backgroundColor: color, opacity: 0.35 }} />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">
                            {formatMinutes(r.totalMin)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {formatMinutes(r.closedMin)}
                            {r.lateCount > 0 && (
                              <span
                                className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400"
                                title={`${r.lateCount} intervention${r.lateCount > 1 ? 's' : ''} passée${r.lateCount > 1 ? 's' : ''} jamais clôturée${r.lateCount > 1 ? 's' : ''}`}
                              >
                                {r.lateCount} à clôturer
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {r.closedCount === r.count ? r.count : `${r.closedCount} / ${r.count}`}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {formatMinutes(r.avgMin)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Le temps compté est la <strong>durée approximative saisie à la prise de rendez-vous</strong>, par pas de
              30 minutes : la clôture n'enregistre aucune durée réelle. C'est donc une mesure de la charge planifiée,
              qui ne vaut que ce que vaut la saisie — une intervention faite hors planning n'y figure pas.
              {late > 0 && (
                <> Sur cette période, {late} intervention{late > 1 ? 's' : ''} déjà passée{late > 1 ? 's' : ''} n'
                {late > 1 ? 'ont' : 'a'} pas été clôturée{late > 1 ? 's' : ''} : ce temps compte dans le total mais
                pas dans le clôturé.</>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
