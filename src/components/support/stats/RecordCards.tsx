import { type ReactNode } from 'react';
import { CalendarCheck, ExternalLink, Hourglass, type LucideIcon, Rabbit, Trophy } from 'lucide-react';
import { type RTStats } from '@/hooks/useRTStats';
import { formatDate, formatHours, ownerColor, ownerLabel, pct } from './format';

const RT_BASE = 'http://rt.in.karavel.com';

/** Seuil de volume au-delà duquel un « record » de vitesse est significatif. */
const MIN_TICKETS = 50;

interface CardProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

const Card = ({ icon: Icon, title, children }: CardProps) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon size={13} /> {title}
    </p>
    {children}
  </div>
);

const Who = ({ login }: { login: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ownerColor(login) }} aria-hidden />
    <span className="font-semibold text-foreground">{ownerLabel(login)}</span>
  </span>
);

export const RecordCards = ({ stats }: { stats: RTStats }) => {
  const eligible = stats.owners.filter((o) => o.owner !== 'Nobody' && o.resolved >= MIN_TICKETS);
  const fastest = [...eligible].sort((a, b) => (a.medianHours ?? Infinity) - (b.medianHours ?? Infinity))[0];
  const sameDay = [...eligible].sort((a, b) => b.sameDayPct - a.sameDayPct)[0];
  const { bestDay, marathon } = stats.team;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {bestDay && (
        <Card icon={CalendarCheck} title="Journée record">
          <p className="text-2xl font-bold tabular-nums text-foreground">{bestDay.count} tickets</p>
          <p className="text-xs text-muted-foreground">le {formatDate(bestDay.date)}</p>
        </Card>
      )}

      {fastest && (
        <Card icon={Rabbit} title="Le plus rapide">
          <p className="text-2xl font-bold tabular-nums text-foreground">{formatHours(fastest.medianHours)}</p>
          <p className="text-xs text-muted-foreground">
            délai médian — <Who login={fastest.owner} />
          </p>
        </Card>
      )}

      {sameDay && (
        <Card icon={Trophy} title="Roi du jour même">
          <p className="text-2xl font-bold tabular-nums text-foreground">{pct(sameDay.sameDayPct)}</p>
          <p className="text-xs text-muted-foreground">
            résolus dans la journée — <Who login={sameDay.owner} />
          </p>
        </Card>
      )}

      {marathon && (
        <Card icon={Hourglass} title="Le marathonien">
          <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(marathon.hours / 24)} jours</p>
          <p className="text-xs text-muted-foreground">
            ticket{' '}
            <a
              href={`${RT_BASE}/Ticket/Display.html?id=${marathon.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              #{marathon.id} <ExternalLink size={10} />
            </a>{' '}
            ouvert le {formatDate(marathon.created.slice(0, 10))} — <Who login={marathon.owner} />
          </p>
        </Card>
      )}
    </div>
  );
};
