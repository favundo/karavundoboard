import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// État de traitement d'une arrivée, stocké dans Supabase (clé = N° ticket RT).
// Aucune donnée d'identité ni mot de passe ici : uniquement l'avancement.
export interface ArriveeWorkflow {
  ticket_rt: string;
  compte_ldap: boolean;
  logiciels_metiers: boolean;
  telephone: boolean;
  technicien: string | null;
  mdp_envoye_at: string | null;
  cloture: boolean;
  cloture_at: string | null;
  updated_at: string;
}

const QK = ['arrivees-workflow'] as const;

export function useArriveesWorkflow() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Record<string, ArriveeWorkflow>> => {
      const { data, error } = await supabase.from('arrivees_workflow').select('*');
      if (error) throw error;
      // Indexé par ticket_rt pour un merge O(1) avec la liste RT.
      return Object.fromEntries((data ?? []).map(r => [r.ticket_rt, r as ArriveeWorkflow]));
    },
  });
}

export function useUpdateArriveeWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: { ticket_rt: string } & Partial<Omit<ArriveeWorkflow, 'ticket_rt'>>,
    ) => {
      const { error } = await supabase
        .from('arrivees_workflow')
        .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'ticket_rt' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
