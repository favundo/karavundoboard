import { queueBadge, queueShort } from '@/lib/rtQueues';

/**
 * Pastille de file, à couleur fixe par file : c'est ce qui permet de trier
 * d'un coup d'œil une liste où les deux files sont mélangées.
 */
export function QueueBadge({
  queue,
  className = '',
  children,
}: {
  queue: string;
  className?: string;
  /** Complément affiché dans la pastille — un compteur, par exemple. */
  children?: React.ReactNode;
}) {
  if (!queue) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${queueBadge(queue)} ${className}`}
    >
      {queueShort(queue)}
      {children}
    </span>
  );
}

export default QueueBadge;
