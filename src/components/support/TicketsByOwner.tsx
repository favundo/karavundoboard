import { useMemo, useState } from 'react';
import { Ticket, ExternalLink, Inbox, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRTTicketsByOwner, type OwnedTicket } from '@/hooks/useRTTicketsByOwner';
import { useMe } from '@/hooks/useMe';
import { useSupportQueues } from '@/contexts/SupportQueuesContext';
import { queueLabel, queueShort } from '@/lib/rtQueues';
import { getTechnicianById } from '@/lib/technicians';

const RT_BASE = 'http://rt.in.karavel.com';
const UNASSIGNED = 'Nobody';

/** Les propriétaires ne sont pas tous dans technicians.ts : RT connaît aussi
 *  d'anciens collègues et des comptes de service. On retombe sur le login. */
const ownerLabel = (login: string) =>
  login === UNASSIGNED ? 'Non assignés' : getTechnicianById(login)?.label ?? login;

const ownerColor = (login: string) => getTechnicianById(login)?.bgColor;

/** Au-delà de 90 jours un ticket ouvert n'est plus « en cours », il dort. */
const ageTone = (d: number | null) =>
  d === null ? 'text-muted-foreground/40'
    : d >= 180 ? 'text-red-600 dark:text-red-400 font-semibold'
    : d >= 90  ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground';

const STATUS_BADGE: Record<string, string> = {
  new:  'bg-orange-100 text-orange-800',
  open: 'bg-blue-100 text-blue-800',
};

const TicketRows = ({ tickets, showQueue }: { tickets: OwnedTicket[]; showQueue: boolean }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-muted/50 text-left">
          {['N°', ...(showQueue ? ['File'] : []), 'Objet', 'État', 'Prio', 'Âge'].map(h => (
            <th key={h} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tickets.map((t, i) => (
          <tr key={t.id} className={`transition-colors hover:bg-muted/20 ${i % 2 ? 'bg-muted/10' : ''}`}>
            <td className="border-b border-border/40 px-3 py-2">
              <a
                href={`${RT_BASE}/Ticket/Display.html?id=${t.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono font-semibold text-primary hover:underline underline-offset-2"
              >
                {t.id}
                <ExternalLink size={11} />
              </a>
            </td>
            {/* Colonne affichée uniquement quand plusieurs files sont mélangées. */}
            {showQueue && (
              <td className="whitespace-nowrap border-b border-border/40 px-3 py-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {queueShort(t.queue)}
                </span>
              </td>
            )}
            <td className="border-b border-border/40 px-3 py-2">{t.subject}</td>
            <td className="border-b border-border/40 px-3 py-2">
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? 'bg-muted text-foreground'}`}>
                {t.status}
              </span>
            </td>
            <td className="border-b border-border/40 px-3 py-2 tabular-nums">{t.priority || '—'}</td>
            <td className={`whitespace-nowrap border-b border-border/40 px-3 py-2 tabular-nums ${ageTone(t.ageDays)}`}>
              {t.ageDays === null ? '—' : `${t.ageDays} j`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Tickets RT ouverts, par propriétaire, sur la ou les files choisies en haut de
 * page. Le technicien connecté est sélectionné d'office ; à défaut, on ouvre sur
 * la pile non assignée, qui est celle qui réclame une décision.
 */
export default function TicketsByOwner() {
  const { queues, queueParam, multi } = useSupportQueues();
  const { data, isFetching } = useRTTicketsByOwner({ queue: queueParam });
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const owners = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byOwner)
      .map(([login, tickets]) => ({ login, tickets }))
      // Non assignés en tête : c'est la file qui doit se vider.
      .sort((a, b) =>
        (a.login === UNASSIGNED ? -1 : b.login === UNASSIGNED ? 1 : 0)
        || b.tickets.length - a.tickets.length);
  }, [data]);

  // Répartition par file : sur une vue mixte, savoir d'où vient le volume.
  const perQueue = useMemo(() => {
    if (!data || !multi) return [];
    const counts = new Map<string, number>();
    for (const tickets of Object.values(data.byOwner)) {
      for (const t of tickets) counts.set(t.queue, (counts.get(t.queue) ?? 0) + 1);
    }
    return queues
      .map(q => ({ queue: q, count: counts.get(q) ?? 0 }))
      .filter(({ count }) => count > 0);
  }, [data, multi, queues]);

  const current =
    selected ??
    (me?.uid && data?.byOwner[me.uid] ? me.uid : owners[0]?.login) ??
    null;

  const tickets = current ? data?.byOwner[current] ?? [] : [];
  const unassigned = data?.byOwner[UNASSIGNED]?.length ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <Ticket size={15} className="text-muted-foreground" />
          Tickets RT ouverts
          <span className="font-normal text-muted-foreground">
            — {queues.map(queueLabel).join(' + ')}
            {data && ` · ${data.total} au total`}
          </span>
          {perQueue.length > 1 && (
            <span className="font-normal text-muted-foreground">
              ({perQueue.map(({ queue, count }) => `${queueShort(queue)} ${count}`).join(' · ')})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ['rt-by-owner'] })}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {!data && !isFetching && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          RT injoignable — la liste des tickets n'a pas pu être chargée.
        </div>
      )}

      {isFetching && !data && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          Interrogation de RT…
        </div>
      )}

      {data && (
        <>
          {unassigned > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm">
              <Inbox size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-foreground">
                <span className="font-semibold">{unassigned} tickets ouverts n'ont pas de propriétaire</span>
                {' '}sur {data.total} — soit {Math.round((unassigned / data.total) * 100)} % de la file.
              </p>
            </div>
          )}

          {/* Sélecteur de propriétaire */}
          <div className="flex flex-wrap gap-1.5">
            {owners.map(({ login, tickets: ts }) => {
              const active = login === current;
              const color = ownerColor(login);
              return (
                <button
                  key={login}
                  type="button"
                  onClick={() => setSelected(login)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {color && !active && (
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  )}
                  {ownerLabel(login)}
                  {login === me?.uid && <span className="opacity-70">(vous)</span>}
                  <span className={`tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}>{ts.length}</span>
                </button>
              );
            })}
          </div>

          {tickets.length > 0
            ? <TicketRows tickets={tickets} showQueue={multi} />
            : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                Aucun ticket ouvert pour {current ? ownerLabel(current) : '—'}.
              </div>
            )}
        </>
      )}
    </section>
  );
}
