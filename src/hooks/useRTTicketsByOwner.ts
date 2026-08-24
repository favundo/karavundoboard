import { useQuery } from '@tanstack/react-query';

export interface OwnedTicket {
  id: string;
  subject: string;
  status: string;
  owner: string;
  queue: string;
  created: string | null;
  priority: number;
  /** Ancienneté en jours — plus parlant qu'une date dans une liste. */
  ageDays: number | null;
}

export interface TicketsByOwner {
  generatedAt: string;
  total: number;
  byOwner: Record<string, OwnedTicket[]>;
  cached: boolean;
}

/**
 * Tickets RT ouverts de toute l'équipe, groupés par propriétaire.
 * Une seule requête RT côté serveur, mise en cache 2 min : RT 4.0.4 met une
 * dizaine de secondes à répondre sur ce volume.
 */
export function useRTTicketsByOwner() {
  return useQuery<TicketsByOwner | undefined>({
    queryKey: ['rt-by-owner'],
    queryFn: async () => {
      const res = await fetch('/api/rt/by-owner');
      if (!res.ok) return undefined;
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
