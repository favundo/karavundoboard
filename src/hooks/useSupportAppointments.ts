import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupportAppointment {
  id: string;
  uid_user: string;
  email_user: string;
  uid_technicien: string;
  service: string;
  asset: string;
  type_intervention: string;
  date_rdv: string;
  duree_minutes: number;
  statut: 'planifie' | 'cloture';
  notes: string | null;
  rappel_envoye: boolean;
  created_at: string;
  updated_at: string;
}

export type AppointmentInsert = Omit<
  SupportAppointment,
  'id' | 'created_at' | 'updated_at' | 'rappel_envoye' | 'statut'
> & { statut?: string };

const QK = ['support_appointments'] as const;

export const useSupportAppointments = () =>
  useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_appointments')
        .select('*')
        .order('date_rdv', { ascending: true });
      if (error) throw error;
      return data as SupportAppointment[];
    },
  });

export const useCreateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AppointmentInsert) => {
      const { data, error } = await supabase
        .from('support_appointments')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SupportAppointment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<SupportAppointment> & { id: string }) => {
      const { data, error } = await supabase
        .from('support_appointments')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as SupportAppointment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useServices = () =>
  useQuery({
    queryKey: ['services_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('service')
        .order('service');
      if (error) throw error;
      return [
        ...new Set(
          (data as { service: string }[])
            .map((r) => r.service)
            .filter(Boolean),
        ),
      ];
    },
    staleTime: 5 * 60 * 1000,
  });
