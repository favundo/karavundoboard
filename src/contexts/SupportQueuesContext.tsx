import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ALL_QUEUE_IDS } from '@/lib/rtQueues';

const STORAGE_KEY = 'kar-support-queues';

interface SupportQueuesValue {
  /** Files RT actuellement affichées — jamais vide. */
  queues: string[];
  setQueues: (queues: string[]) => void;
  /** Paramètre `queue` des appels /api/rt/* : 'sos' ou 'sos,sos-agences'. */
  queueParam: string;
  /** Vrai quand plusieurs files sont mélangées : il faut alors afficher d'où vient chaque ticket. */
  multi: boolean;
}

const SupportQueuesContext = createContext<SupportQueuesValue>({
  queues: ALL_QUEUE_IDS,
  setQueues: () => {},
  queueParam: ALL_QUEUE_IDS.join(','),
  multi: ALL_QUEUE_IDS.length > 1,
});

/** Une sélection vide n'afficherait rien : on retombe sur toutes les files. */
const readStored = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const kept = Array.isArray(parsed) ? parsed.filter((q) => ALL_QUEUE_IDS.includes(q)) : [];
    return kept.length ? kept : ALL_QUEUE_IDS;
  } catch {
    return ALL_QUEUE_IDS;
  }
};

/**
 * Choix des files RT, partagé par le bandeau prioritaire et la liste des
 * tickets ouverts : les deux doivent parler du même périmètre. Persisté en
 * localStorage — chaque technicien retrouve sa vue.
 */
export function SupportQueuesProvider({ children }: { children: React.ReactNode }) {
  const [queues, setQueuesState] = useState<string[]>(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
  }, [queues]);

  const value = useMemo<SupportQueuesValue>(() => ({
    queues,
    setQueues: (next: string[]) => setQueuesState(next.length ? next : ALL_QUEUE_IDS),
    queueParam: queues.join(','),
    multi: queues.length > 1,
  }), [queues]);

  return <SupportQueuesContext.Provider value={value}>{children}</SupportQueuesContext.Provider>;
}

export const useSupportQueues = () => useContext(SupportQueuesContext);
