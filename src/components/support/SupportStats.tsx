import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, Inbox, Loader2,
  RefreshCw, Scale, TrendingUp, Users,
} from 'lucide-react';
import { useRefreshRTStats, useRTStats } from '@/hooks/useRTStats';
import { useTheme } from '@/contexts/ThemeContext';
import { VIZ } from '@/lib/vizColors';
import { StatTile } from './stats/StatTile';
import { Podium } from './stats/Podium';
import { MonthlyFlowChart } from './stats/MonthlyFlowChart';
import { ResolutionHeatmap } from './stats/ResolutionHeatmap';
import { TechSparklines } from './stats/TechSparklines';
import { RecordCards } from './stats/RecordCards';
import { formatHours, MONTH_LABELS, ownerColor, ownerLabel, pct, realDemand } from './stats/format';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [0, 1, 2, 3].map((n) => CURRENT_YEAR - n);
const QUEUES = ['sos', 'sos-am', 'sos-agences', 'Telephonie', 'AB Croisière', 'Préparation Ordinateur'];

const SupportStats = () => {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [queue, setQueue] = useState('sos');
  const { theme } = useTheme();
  const palette = VIZ[theme === 'dark' ? 'dark' : 'light'];

  const { data, isLoading, error } = useRTStats(year, queue);
  const refresh = useRefreshRTStats();

  const monthsElapsed = useMemo(
    () => (year < CURRENT_YEAR ? 12 : new Date().getMonth() + 1),
    [year],
  );

  const exportCsv = () => {
    if (!data) return;
    const head = ['Technicien', 'Résolus', 'Rejetés', 'Part', 'Score', 'Points difficulté', 'Bonus priorité',
      'Tickets urgents', 'Tickets notés', 'Difficulté moyenne',
      'Délai médian (h)', 'P90 (h)', 'Jour même', 'Mois n°1', ...MONTH_LABELS];
    const rows = data.owners.map((o) => [
      ownerLabel(o.owner), o.resolved, o.rejected, o.share === null ? '' : (o.share * 100).toFixed(1),
      o.score, o.difficultyScore, o.bonus, o.urgent, o.scored, o.avgDifficulty?.toFixed(2) ?? '',
      o.medianHours?.toFixed(1) ?? '', o.p90Hours?.toFixed(0) ?? '',
      (o.sameDayPct * 100).toFixed(0), o.crowns, ...o.months,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-rt-${queue}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtres — une seule rangée, au-dessus de tout le reste */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          aria-label="Année"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={queue}
          onChange={(e) => setQueue(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          aria-label="File RT"
        >
          {QUEUES.map((q) => <option key={q} value={q}>File {q}</option>)}
        </select>

        <button
          onClick={() => refresh.mutate({ year, queue })}
          disabled={refresh.isPending || isLoading}
          title="Recalcule depuis RT sans attendre le rafraîchissement de 8 h (~20 s)"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
          {refresh.isPending ? 'Calcul…' : 'Actualiser'}
        </button>

        <button
          onClick={exportCsv}
          disabled={!data}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Download size={14} /> CSV
        </button>

        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.totals.workdays} jours ouvrés · données RT du{' '}
            {new Date(data.cachedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            {data.stale ? ' (actualisation en cours…)' : ' · actualisation auto chaque matin à 8 h'}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="animate-spin" size={22} />
          <p className="text-sm">Interrogation de RT sur l'année {year}…</p>
          <p className="text-xs">Le premier chargement prend une vingtaine de secondes, ensuite c'est instantané.</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle size={16} />
          RT n'a pas répondu. Vérifier que l'API (`karavundoboard-api`) tourne et que RT_USER / RT_PASS sont configurés.
        </div>
      )}

      {data && (
        <>
          {/* Chiffres clés */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile
              icon={CheckCircle2} tone="good"
              label="Tickets résolus" value={String(data.totals.resolved)}
              hint={`+ ${data.totals.rejected} rejetés`}
            />
            <StatTile
              icon={Inbox}
              label="Tickets créés" value={String(data.totals.created)}
              hint={`${data.totals.openFromYear} encore ouverts`}
            />
            <StatTile
              icon={Scale}
              tone={realDemand(data.totals) > 0 && data.totals.resolved / realDemand(data.totals) >= 0.95 ? 'good' : 'warning'}
              label="Absorption"
              value={realDemand(data.totals) > 0 ? pct(data.totals.resolved / realDemand(data.totals)) : '—'}
              hint="résolus ÷ demande réelle"
            />
            <StatTile
              icon={Clock}
              label="Délai médian" value={formatHours(data.team.medianHours)}
              hint={`90 % sous ${formatHours(data.team.p90Hours)}`}
            />
            <StatTile
              icon={TrendingUp}
              label="Jour même" value={pct(data.team.sameDayPct)}
              hint="résolus dans la journée"
            />
            <StatTile
              icon={Users}
              label="Cadence" value={`${data.totals.perWorkday.toFixed(1)} /j`}
              hint="par jour ouvré, toute l'équipe"
            />
          </div>

          <Podium owners={data.owners} palette={palette} />

          <MonthlyFlowChart months={data.months} palette={palette} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ResolutionHeatmap heat={data.heat} palette={palette} />
            </div>
            <RecordCards stats={data} />
          </div>

          <TechSparklines owners={data.owners} monthsElapsed={monthsElapsed} />

          {/* Vue tableau — toute l'information des graphiques, en chiffres */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Détail par technicien
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Technicien</th>
                    <th className="px-2 py-2 text-right font-medium">Résolus</th>
                    <th className="px-2 py-2 text-right font-medium">Rejetés</th>
                    <th className="px-2 py-2 text-right font-medium">Part</th>
                    <th className="px-2 py-2 text-right font-medium">Score</th>
                    <th className="px-2 py-2 text-right font-medium">Diff. moy.</th>
                    <th className="px-2 py-2 text-right font-medium">Délai méd.</th>
                    <th className="px-2 py-2 text-right font-medium">P90</th>
                    <th className="px-2 py-2 text-right font-medium">Jour même</th>
                    <th className="px-2 py-2 text-right font-medium">Meilleur jour</th>
                    <th className="px-2 py-2 text-right font-medium">Mois n°1</th>
                  </tr>
                </thead>
                <tbody>
                  {data.owners.map((o) => (
                    <tr key={o.owner} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ownerColor(o.owner) }} aria-hidden />
                          <span className={o.owner === 'Nobody' ? 'italic text-muted-foreground' : 'text-foreground'}>
                            {ownerLabel(o.owner)}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{o.resolved}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{o.rejected}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{o.share === null ? '—' : pct(o.share)}</td>
                      <td
                        className="px-2 py-2 text-right tabular-nums text-foreground"
                        title={o.scored || o.bonus
                          ? `${o.difficultyScore} pt de difficulté (${o.scored} ticket${o.scored > 1 ? 's' : ''} noté${o.scored > 1 ? 's' : ''} sur ${o.resolved}) + ${o.bonus} de bonus (${o.urgent} urgent${o.urgent > 1 ? 's' : ''})`
                          : 'aucun ticket noté, aucun ticket urgent'}
                      >
                        {o.scored || o.bonus ? o.score : '—'}
                        {o.bonus > 0 && <span className="ml-1 text-[11px] font-medium text-muted-foreground">+{o.bonus}</span>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {o.avgDifficulty === null ? '—' : o.avgDifficulty.toFixed(1)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatHours(o.medianHours)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatHours(o.p90Hours)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{pct(o.sameDayPct)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {o.bestDay ? `${o.bestDay.count} le ${o.bestDay.date.slice(8)}/${o.bestDay.date.slice(5, 7)}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{o.crowns || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Le décompte s'appuie sur le propriétaire <em>actuel</em> du ticket, pas sur l'utilisateur qui a
              effectivement passé le statut à « resolved » : un ticket réattribué après coup est crédité à son dernier
              propriétaire. RT 4.0.4 ne permet pas de remonter l'auteur de la transaction sans lire l'historique de
              chaque ticket, ce que la file ne supporterait pas.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Le <strong>score</strong> est la somme des notes de difficulté (1 à 5) des tickets résolus.{' '}
              {data.totals.scored > 0
                ? `${data.totals.scored} ticket${data.totals.scored > 1 ? 's' : ''} noté${data.totals.scored > 1 ? 's' : ''} sur ${data.totals.resolved} résolus`
                : 'Aucun ticket noté pour l\'instant'} — les tickets sans note n'entrent ni dans le score ni dans la
              difficulté moyenne, un ticket non noté n'est pas un ticket facile. Le champ n'existe que depuis le
              26 août 2026 : rien d'antérieur ne peut être noté rétroactivement.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              S'y ajoute un <strong>bonus de priorité</strong> sur les tickets résolus : +1 à partir de la priorité 4
              (urgent), +2 à partir de la 5 (bloquant). Des seuils et non des égalités — quelques tickets portent
              encore 9 ou 10, hérités de l'échelle 0-100 de RT. Le bonus ne dépend pas de la note : un bloquant peut
              être simple à traiter, le prendre en charge compte quand même.{' '}
              {data.totals.urgent > 0
                ? `${data.totals.urgent} ticket${data.totals.urgent > 1 ? 's' : ''} urgent${data.totals.urgent > 1 ? 's' : ''} sur la période.`
                : 'Aucun ticket en priorité 4 ou plus sur la période.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default SupportStats;
