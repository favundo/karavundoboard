import { Filter } from 'lucide-react';
import { useSupportQueues } from '@/contexts/SupportQueuesContext';
import { ALL_QUEUE_IDS, SUPPORT_QUEUES } from '@/lib/rtQueues';

/** Une file à la fois, ou toutes — pas de combinaison partielle à composer. */
const OPTIONS = [
  ...SUPPORT_QUEUES.map((q) => ({ key: q.id, label: q.short, title: q.label, ids: [q.id], dot: q.dot })),
  {
    key: 'all',
    label: 'Les deux',
    title: SUPPORT_QUEUES.map((q) => q.label).join(' + '),
    ids: ALL_QUEUE_IDS,
    dot: undefined,
  },
];

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Choix de la ou des files RT affichées dans tout l'onglet Support
 * (bandeau prioritaire + tickets ouverts par technicien).
 */
export function QueueFilter({ className = '' }: { className?: string }) {
  const { queues, setQueues } = useSupportQueues();

  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="Files RT affichées">
      <Filter size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex rounded-lg border border-border bg-card p-0.5">
        {OPTIONS.map(({ key, label, title, ids, dot }) => {
          const active = same(queues, ids);
          return (
            <button
              key={key}
              type="button"
              title={title}
              aria-pressed={active}
              onClick={() => setQueues(ids)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {/* Rappel de la couleur des pastilles ; masqué sur le bouton actif,
                  dont le fond plein rendrait le point illisible. */}
              {dot && !active && (
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QueueFilter;
