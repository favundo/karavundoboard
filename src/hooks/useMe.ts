import { useQuery } from '@tanstack/react-query';
import { getTechnicianById, type Technician } from '@/lib/technicians';

/**
 * Identité de l'utilisateur connecté, telle qu'Authelia la transmet à Nginx
 * puis à l'API (voir GET /api/me dans server/index.js).
 *
 * `uid` est le sAMAccountName Active Directory. Il correspond exactement aux
 * `id` de src/lib/technicians.ts et à support_appointments.uid_technicien :
 * aucune table de correspondance n'est nécessaire.
 */
export interface Me {
  authenticated: boolean;
  /** true quand l'identité vient de DEV_USER et non d'Authelia. */
  dev: boolean;
  uid: string;
  displayName: string;
  email: string | null;
  groups: string[];
  isTech: boolean;
  isAdmin: boolean;
}

/**
 * La personnalisation est TOUJOURS additive : hors authentification — en
 * développement sans DEV_USER, ou si l'API ne répond pas — le hook renvoie
 * `undefined` et l'interface doit rester pleinement utilisable.
 */
export function useMe() {
  return useQuery<Me | undefined>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me');
      if (!res.ok) return undefined;
      return res.json();
    },
    // L'identité ne change pas au cours d'une session : inutile de la relire.
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Fiche technicien de l'utilisateur connecté, ou undefined s'il n'en est pas un
 * — un administrateur de passage, ou un compte absent de technicians.ts.
 */
export function useMeAsTechnician(): Technician | undefined {
  const { data: me } = useMe();
  return me?.uid ? getTechnicianById(me.uid) : undefined;
}
