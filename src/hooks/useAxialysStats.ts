import { useQuery } from '@tanstack/react-query';

/**
 * Statistiques de la téléphonie du support IT (Axialys).
 *
 * Lues sur la table `axialys_calls`, jamais sur Axialys : leur API ignore les
 * paramètres de période et ne rend que les dernières 24-48 h. C'est le job
 * quotidien de `server/index.js` qui constitue l'historique, jour après jour.
 * Voir la migration 20260907000000_add_axialys_calls.sql.
 */

/** Un créneau — heure, jour ou jour de semaine — et ce qui s'y est passé. */
export interface AxialysBucket {
  key: string | number;
  total: number;
  answered: number;
}

export interface AxialysAgent {
  /** Identifiant Axialys. `null` sur une période rattrapée depuis un CSV : le
   *  portail n'exporte que le nom de l'agent. */
  idOp: number | null;
  /** Prénom suivi de l'équipe, « Abdelrahim TSI ». Les agents téléphonie ne
   *  sont pas ceux de technicians.ts. */
  name: string;
  in: number;
  out: number;
  total: number;
  commTotalSec: number;
  commAvgSec: number | null;
  postAvgSec: number | null;
}

export interface AxialysStats {
  period: { from: string | null; to: string | null; timezone: string };
  inbound: {
    total: number;
    answered: number;
    missed: number;
    answerRate: number | null;
    byStatus: Record<string, number>;
    /** `null` quand aucune ligne de la période ne porte de temps d'attente —
     *  c'est le cas des périodes rattrapées par import CSV. */
    waitMedianSec: number | null;
    waitAvgSec: number | null;
    commMedianSec: number | null;
    commAvgSec: number | null;
    abandonUnder15: number | null;
  };
  outbound: { total: number; answered: number; commAvgSec: number | null };
  agents: AxialysAgent[];
  byDay: AxialysBucket[];
  byHour: AxialysBucket[];
  byWeekday: AxialysBucket[];
  /** Rattrapage des manqués. Réservé aux administrateurs à l'affichage. */
  callbacks: {
    missed: number;
    calledBack: number;
    rate: number | null;
    medianDelayMin: number | null;
    windowHours: number;
  };
  generatedAt: string;
}

export function useAxialysStats(from: string, to: string) {
  return useQuery<AxialysStats>({
    queryKey: ['axialys-stats', from, to],
    queryFn: async () => {
      const res = await fetch(`/api/axialys/stats?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Lecture des appels impossible');
      return res.json();
    },
    // Les données ne bougent qu'une fois par nuit, à l'ingestion.
    staleTime: 10 * 60 * 1000,
  });
}
