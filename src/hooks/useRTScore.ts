import { useQuery } from '@tanstack/react-query';

export interface RTScoreOwner {
  owner: string;
  score: number;             // difficulté + bonus de priorité, sur l'année
  today: number;             // la part faite aujourd'hui
  todayTickets: number;      // tickets ayant rapporté des points aujourd'hui
  difficultyScore: number;
  bonus: number;
  urgent: number;
  scored: number;
}

export interface RTScore {
  year: number;
  queues: string[];
  generatedAt: string;
  cachedAt: string;
  stale: boolean;
  owners: RTScoreOwner[];
  team: Omit<RTScoreOwner, 'owner'>;
}

/**
 * Score des techniciens (voir GET /api/rt/score). Endpoint léger — six requêtes
 * RT sélectives, pas le balayage complet de /api/rt/stats — et cache serveur de
 * 5 minutes pour que « aujourd'hui » bouge dans la journée.
 */
export function useRTScore() {
  return useQuery<RTScore | undefined>({
    queryKey: ['rt-score'],
    queryFn: async () => {
      const res = await fetch('/api/rt/score');
      if (!res.ok) return undefined;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
