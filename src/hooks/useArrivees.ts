import { useQuery } from '@tanstack/react-query';

// Une arrivée = un ticket RT « [LDAP][RH] Creation de compte: … » dont le corps
// a été reparsé côté serveur (voir /api/rt/arrivees dans server/index.js).
export interface Arrivee {
  id: string;
  subject: string;
  status: string;
  owner: string;
  queue: string;
  requestors: string;
  created: string;
  lastUpdated: string;
  prenom: string | null;
  nom: string | null;
  login: string | null;
  service: string | null;
  responsable: string | null;
  fonction: string | null;
  societe: string | null;
  dateArrivee: string | null;
  responsableEmail: string | null;
}

export function useArrivees() {
  return useQuery<Arrivee[]>({
    queryKey: ['rt-arrivees'],
    queryFn: async () => {
      const res = await fetch('/api/rt/arrivees');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
