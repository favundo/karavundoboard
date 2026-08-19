import { useQuery } from '@tanstack/react-query';

export interface RTPriorityTicket {
  id: string;
  subject: string;
  status: string;
  owner: string;
  queue: string;
  created: string;
  priority: number;
}

/**
 * Tickets à haute priorité (file sos par défaut, seuil et files pilotés par
 * RT_PRIORITY_MIN / RT_PRIORITY_QUEUES côté serveur).
 */
export function useRTPriorityTickets(options?: { min?: number; queue?: string }) {
  const params = new URLSearchParams();
  if (options?.min !== undefined) params.set('min', String(options.min));
  if (options?.queue) params.set('queue', options.queue);
  const qs = params.toString();

  return useQuery<RTPriorityTicket[]>({
    queryKey: ['rt-priority', options?.min ?? null, options?.queue ?? null],
    queryFn: async () => {
      const res = await fetch(`/api/rt/priority${qs ? `?${qs}` : ''}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
