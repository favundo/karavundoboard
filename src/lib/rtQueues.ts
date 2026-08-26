/**
 * Files RT suivies par le dashboard Support.
 * `short` sert aux pastilles et aux boutons, où la place manque.
 */
export interface RTQueue {
  id: string;
  label: string;
  short: string;
  /** Pastille de file. Teintes tenues à l'écart de l'orange/bleu des états
   *  (new/open) et du rouge des priorités, pour ne pas se lire comme eux. */
  badge: string;
  /** Point de couleur du sélecteur, pour relier le choix à la pastille. */
  dot: string;
}

export const SUPPORT_QUEUES: RTQueue[] = [
  {
    id: 'sos', label: 'SOS Siège', short: 'Siège',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
    dot: '#6366f1',
  },
  {
    id: 'sos-agences', label: 'SOS Agences', short: 'Agences',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
    dot: '#14b8a6',
  },
];

export const ALL_QUEUE_IDS = SUPPORT_QUEUES.map((q) => q.id);

/** RT peut renvoyer une file qu'on ne suit pas (ticket déplacé) : on l'affiche telle quelle. */
export const queueShort = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.short ?? id;

export const queueLabel = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.label ?? id;

/** File inconnue (ticket déplacé) : gris neutre plutôt qu'une couleur au hasard. */
export const queueBadge = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.badge ?? 'bg-muted text-muted-foreground';

export const queueDot = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.dot;
