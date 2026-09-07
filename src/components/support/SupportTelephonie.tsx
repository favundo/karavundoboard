import { useMemo, useState } from 'react';
import {
  Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCw, Timer, TriangleAlert,
} from 'lucide-react';
import { useAxialysStats, type AxialysBucket } from '@/hooks/useAxialysStats';
import { useTheme } from '@/contexts/ThemeContext';
import { VIZ } from '@/lib/vizColors';
import { AdminOnly } from '@/components/AdminOnly';
import { StatTile } from './stats/StatTile';
import { CallsBarChart } from './telephonie/CallsBarChart';
import { formatDayKey, formatHourKey, formatWeekdayKey } from './telephonie/format';

/** Périodes proposées. En jours, bornées à hier — le jour en cours est partiel. */
const RANGES = [
  { days: 7,   label: '7 jours' },
  { days: 30,  label: '30 jours' },
  { days: 90,  label: '90 jours' },
  { days: 365, label: '12 mois' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Secondes → « 1 min 23 » ou « 45 s ». `null` reste un tiret, jamais un zéro. */
const dur = (s: number | null | undefined) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
};

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`;

/** Le créneau qui décroche le moins, à volume significatif. */
function worstBucket(buckets: AxialysBucket[], minTotal: number) {
  return buckets
    .filter((b) => b.total >= minTotal)
    .map((b) => ({ ...b, rate: (b.total - b.answered) / b.total }))
    .sort((a, b) => b.rate - a.rate)[0];
}

const SupportTelephonie = () => {
  const [days, setDays] = useState(30);
  const [ingesting, setIngesting] = useState(false);
  const { theme } = useTheme();
  const palette = VIZ[theme === 'dark' ? 'dark' : 'light'];

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    return { from: iso(start), to: iso(end) };
  }, [days]);

  const { data, isLoading, error, refetch } = useAxialysStats(from, to);

  const runIngest = async () => {
    setIngesting(true);
    try {
      await fetch('/api/axialys/ingest', { method: 'POST' });
      await refetch();
    } finally {
      setIngesting(false);
    }
  };

  const worstHour = data ? worstBucket(data.byHour, 10) : undefined;

  return (
    <div className="space-y-4">
      {/* Filtres — une seule rangée, au-dessus de tout le reste */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          aria-label="Période"
        >
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>

        <AdminOnly>
          <button
            onClick={runIngest}
            disabled={ingesting}
            title="Relit les dernières 24-48 h chez Axialys sans attendre le job de 4 h"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={14} className={ingesting ? 'animate-spin' : ''} />
            {ingesting ? 'Ingestion…' : 'Ingérer'}
          </button>
        </AdminOnly>

        {data?.period.from && (
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(data.period.from).toLocaleDateString('fr-FR')} →{' '}
            {new Date(data.period.to!).toLocaleDateString('fr-FR')} · heures locales ({data.period.timezone})
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="animate-spin" size={22} />
          <p className="text-sm">Lecture des appels…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de lire les appels. L'API est-elle démarrée ?
        </div>
      )}

      {/* Aucune donnée n'est une information en soi, et surtout PAS « 0 % de
          décroché » : la table peut être vide parce que l'ingestion n'a jamais
          tourné. On le dit, plutôt que d'afficher des chiffres crédibles et faux. */}
      {data && data.inbound.total === 0 && data.outbound.total === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-foreground">Aucun appel enregistré sur cette période</p>
              <p className="text-muted-foreground">
                Ce n'est pas « zéro appel » : c'est l'absence de données. L'API Axialys ne rend que
                les dernières 24-48 h, l'historique est constitué par l'ingestion nocturne — si elle
                n'a pas encore tourné, la table est vide.
              </p>
              <p className="text-muted-foreground">
                Vérifier que <span className="font-mono text-foreground">AXIALYS_TOKEN</span> est
                renseigné côté serveur, puis lancer une ingestion. Pour le passé, importer un export
                CSV du portail avec <span className="font-mono text-foreground">scripts/import-axialys-csv.js</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {data && (data.inbound.total > 0 || data.outbound.total > 0) && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatTile
              icon={PhoneIncoming} label="Appels entrants" value={String(data.inbound.total)}
              hint={`${Math.round(data.inbound.total / Math.max(days, 1) * 7)} par semaine`}
            />
            <StatTile
              icon={Phone} label="Taux de décroché" value={pct(data.inbound.answerRate)}
              hint={`${data.inbound.answered} décrochés`}
              tone={data.inbound.answerRate !== null && data.inbound.answerRate < 0.8 ? 'warning' : 'good'}
            />
            <StatTile
              icon={PhoneMissed} label="Appels manqués" value={String(data.inbound.missed)}
              hint={Object.entries(data.inbound.byStatus)
                .filter(([s]) => s !== 'ANSWER')
                .map(([s, n]) => `${n} ${s.toLowerCase()}`)
                .join(' · ') || undefined}
              tone={data.inbound.missed > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              icon={Timer} label="Communication médiane" value={dur(data.inbound.commMedianSec)}
              hint={data.inbound.waitMedianSec === null
                ? 'attente non disponible sur cette période'
                : `attente médiane ${dur(data.inbound.waitMedianSec)}`}
            />
            <StatTile
              icon={PhoneOutgoing} label="Appels sortants" value={String(data.outbound.total)}
              hint={`${data.outbound.answered} aboutis`}
            />
          </div>

          {/* Le graphique qui porte la décision : où sont les trous de couverture. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Couverture par heure</h3>
                <p className="text-xs text-muted-foreground">
                  Hauteur = volume reçu, orange = non décroché. Les deux comptent : un fort taux de
                  manqués sur trois appels ne vaut pas le même arbitrage que sur trente.
                </p>
              </div>
              {worstHour && (
                <p className="text-xs text-muted-foreground">
                  Pire créneau :{' '}
                  <span className="font-semibold text-foreground">{worstHour.key}h</span>{' '}
                  — {Math.round(worstHour.rate * 100)} % manqués sur {worstHour.total} appels
                </p>
              )}
            </div>
            <CallsBarChart data={data.byHour} palette={palette} formatKey={formatHourKey} height={240} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Par jour de la semaine</h3>
              <CallsBarChart data={data.byWeekday} palette={palette} formatKey={formatWeekdayKey} height={200} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Jour par jour</h3>
              <CallsBarChart data={data.byDay} palette={palette} formatKey={formatDayKey} height={200} />
            </div>
          </div>

          {/* Par agent — et non par technicien : les agents de la ligne
              téléphonique ne sont pas ceux de technicians.ts. */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Par agent</h3>
              <p className="text-xs text-muted-foreground">
                Les agents de la ligne téléphonique sont l'équipe TSI, distincte des techniciens du
                planning support.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Agent</th>
                    <th className="px-4 py-2 text-right font-semibold">Entrants pris</th>
                    <th className="px-4 py-2 text-right font-semibold">Sortants</th>
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                    <th className="px-4 py-2 text-right font-semibold">Comm. moy.</th>
                    <th className="px-4 py-2 text-right font-semibold">Temps en ligne</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((a) => (
                    <tr key={a.idOp ?? a.name} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 font-medium text-foreground">{a.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{a.in}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{a.out}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-foreground">{a.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{dur(a.commAvgSec)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {Math.round(a.commTotalSec / 3600)} h
                      </td>
                    </tr>
                  ))}
                  {data.agents.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Aucun appel attribué à un agent sur la période.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Réservé aux administrateurs : cet indicateur met l'équipe en cause
              et n'a pas sa place sur le tableau de bord partagé. */}
          <AdminOnly>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Rattrapage des appels manqués
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      admin
                    </span>
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    Part des appels manqués suivis d'un appel sortant vers le même numéro dans les{' '}
                    {data.callbacks.windowHours} h. La borne est délibérée : sans elle, un appel sans
                    rapport passé plusieurs jours plus tard serait compté comme un rappel et
                    gonflerait le chiffre du simple au double.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tabular-nums text-foreground">{pct(data.callbacks.rate)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.callbacks.calledBack} / {data.callbacks.missed} rappelés
                  </p>
                  {data.callbacks.medianDelayMin !== null && (
                    <p className="text-xs text-muted-foreground">
                      délai médian {data.callbacks.medianDelayMin} min
                    </p>
                  )}
                </div>
              </div>
            </div>
          </AdminOnly>
        </>
      )}
    </div>
  );
};

export default SupportTelephonie;
