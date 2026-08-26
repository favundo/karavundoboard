/**
 * Files RT suivies par le dashboard Support.
 * `short` sert aux pastilles et aux boutons, où la place manque.
 */
export interface RTQueue {
  id: string;
  label: string;
  short: string;
}

export const SUPPORT_QUEUES: RTQueue[] = [
  { id: 'sos',         label: 'SOS Siège',   short: 'Siège'   },
  { id: 'sos-agences', label: 'SOS Agences', short: 'Agences' },
];

export const ALL_QUEUE_IDS = SUPPORT_QUEUES.map((q) => q.id);

/** RT peut renvoyer une file qu'on ne suit pas (ticket déplacé) : on l'affiche telle quelle. */
export const queueShort = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.short ?? id;

export const queueLabel = (id: string) =>
  SUPPORT_QUEUES.find((q) => q.id === id)?.label ?? id;
