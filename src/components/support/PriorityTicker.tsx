import { AlertTriangle } from 'lucide-react';
import { useRTPriorityTickets, type RTPriorityTicket } from '@/hooks/useRTPriorityTickets';
import { useSupportQueues } from '@/contexts/SupportQueuesContext';
import { queueShort } from '@/lib/rtQueues';

const RT_BASE = 'http://rt.in.karavel.com';

// Le défilement dure ~7 s par ticket : peu de tickets → passage lent et lisible,
// beaucoup de tickets → la boucle reste bornée à 2 min.
const SECONDS_PER_TICKET = 7;
const MIN_DURATION = 25;
const MAX_DURATION = 120;

function TicketEntry({ ticket, showQueue }: { ticket: RTPriorityTicket; showQueue: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-5">
      <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-destructive">
        P{ticket.priority}
      </span>
      {/* Deux files mélangées : sans cette pastille on ne sait plus qui est concerné. */}
      {showQueue && ticket.queue && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {queueShort(ticket.queue)}
        </span>
      )}
      <a
        href={`${RT_BASE}/Ticket/Display.html?id=${ticket.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm font-semibold text-destructive underline-offset-2 hover:underline"
      >
        #{ticket.id}
      </a>
      <span className="text-sm text-foreground/80">{ticket.subject || '(sans objet)'}</span>
      {ticket.owner === 'Nobody' && (
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          non assigné
        </span>
      )}
      <span className="text-border" aria-hidden="true">•</span>
    </span>
  );
}

/**
 * Bandeau défilant des tickets RT à haute priorité, sur les files choisies.
 * Le contenu est dupliqué pour que la boucle CSS (translateX -50 %) soit sans
 * raccord ; la copie est masquée aux lecteurs d'écran.
 */
export function PriorityTicker() {
  const { queueParam, multi } = useSupportQueues();
  const { data: tickets, isError } = useRTPriorityTickets({ queue: queueParam });

  if (isError || !tickets?.length) return null;

  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, tickets.length * SECONDS_PER_TICKET));

  return (
    // Pas de border-b : la sous-navigation qui suit porte déjà son propre border-t.
    <div className="border-t border-destructive/30 bg-destructive/5">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <div className="flex shrink-0 items-center gap-1.5 text-destructive">
          <AlertTriangle size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Priorité ({tickets.length})
          </span>
        </div>

        <div className="group relative flex-1 overflow-hidden motion-reduce:overflow-x-auto">
          <div
            className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ animationDuration: `${duration}s` }}
          >
            {tickets.map(t => <TicketEntry key={t.id} ticket={t} showQueue={multi} />)}
            <span className="flex" aria-hidden="true">
              {tickets.map(t => <TicketEntry key={`dup-${t.id}`} ticket={t} showQueue={multi} />)}
            </span>
          </div>
          {/* Fondus latéraux : les tickets apparaissent/disparaissent en douceur */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default PriorityTicker;
