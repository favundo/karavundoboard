import { useMutation } from '@tanstack/react-query';
import { loadTechnicians, type Technician } from '@/lib/technicians';

/**
 * Écritures sur la table `technicians`, via l'API Express : c'est elle qui
 * vérifie Remote-Groups (403 hors karinventaire-admin). Le masquage dans
 * l'interface n'est que le premier rideau.
 */
async function call(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Erreur ${res.status}`);
  return body;
}

export type NewTechnician = Omit<Technician, 'active'>;

/** Crée un technicien, ou réactive un archivé portant le même identifiant. */
export const useCreateTechnician = () =>
  useMutation<Technician, Error, NewTechnician>({
    mutationFn: (t) =>
      call('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      }),
    onSuccess: () => loadTechnicians(),
  });

/** Archive : le technicien quitte les listes de choix, pas l'historique. */
export const useArchiveTechnician = () =>
  useMutation<Technician, Error, string>({
    mutationFn: (id) => call(`/api/technicians/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => loadTechnicians(),
  });
