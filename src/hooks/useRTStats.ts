import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RTOwnerStats {
  owner: string;
  resolved: number;
  rejected: number;
  share: number | null;      // part du travail assigné ; null pour « Non assigné »
  score: number;             // difficulté + bonus de priorité
  difficultyScore: number;   // somme des notes des tickets notés
  bonus: number;             // points de priorité (>= 4 : +1, >= 5 : +2)
  urgent: number;            // tickets résolus en priorité >= 4
  scored: number;            // nombre de tickets notés (le reste est hors score)
  difficulty: number[];      // répartition des notes, index 0 = note 1
  avgDifficulty: number | null;
  months: number[];          // 12 entrées, index 0 = janvier
  medianHours: number | null;
  p90Hours: number | null;
  sameDayPct: number;
  bestDay: { date: string; count: number } | null;
  crowns: number;            // nombre de mois terminés n°1
}

export interface RTMonthStats {
  month: string;             // 'YYYY-MM'
  created: number;
  rejected: number;          // rejets clôturés dans le mois
  rejectedCreated: number;   // entrées du mois qui ont fini rejetées
  resolved: number;
}

export interface RTStats {
  year: number;
  queue: string;
  generatedAt: string;
  cachedAt: string;
  stale: boolean;
  totals: {
    resolved: number;
    rejected: number;
    created: number;
    rejectedCreated: number;
    openFromYear: number;
    unassigned: number;
    perWorkday: number;
    workdays: number;
    score: number;
    scored: number;
    bonus: number;
    urgent: number;
  };
  team: {
    medianHours: number | null;
    p90Hours: number | null;
    sameDayPct: number;
    bestDay: { date: string; count: number } | null;
    marathon: { id: string; owner: string; created: string; resolved: string; hours: number } | null;
  };
  owners: RTOwnerStats[];
  months: RTMonthStats[];
  heat: number[][];          // [jour 0=lundi][heure 0-23]
}

const statsKey = (year: number, queue: string) => ['rt-stats', year, queue] as const;

const fetchStats = async (year: number, queue: string, force = false): Promise<RTStats> => {
  const res = await fetch(
    `/api/rt/stats?year=${year}&queue=${encodeURIComponent(queue)}${force ? '&refresh=1' : ''}`,
  );
  if (!res.ok) throw new Error('RT indisponible');
  return res.json();
};

/**
 * Statistiques annuelles d'une file RT (tickets résolus par technicien, délais,
 * flux entrant/sortant). Le serveur reconstruit son cache tous les matins à 8 h ;
 * en journée la page sert ce cache et répond instantanément.
 */
export function useRTStats(year: number, queue: string) {
  return useQuery<RTStats>({
    queryKey: statsKey(year, queue),
    queryFn: () => fetchStats(year, queue),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Actualisation manuelle : contourne le cache serveur et attend le vrai calcul
 * (~18 s côté RT). À réserver au bouton « Actualiser » — le reste du temps le
 * rafraîchissement quotidien suffit.
 */
export function useRefreshRTStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, queue }: { year: number; queue: string }) => fetchStats(year, queue, true),
    onSuccess: (data, { year, queue }) => qc.setQueryData(statsKey(year, queue), data),
  });
}
