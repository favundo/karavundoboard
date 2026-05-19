import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Infos live depuis RT ──────────────────────────────────────────────────────

export interface RTTicketInfo {
  id: string;
  subject: string;
  status: string;
  owner: string;
  queue: string;
  created: string;
  lastUpdated: string;
}

export function useRTTicket(ticketId: string | null) {
  return useQuery<RTTicketInfo | null>({
    queryKey: ['rt-ticket', ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/rt/ticket/${ticketId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!ticketId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export interface TicketRT {
  id: string;
  ticket_rt: string;
  note: string | null;
  technicien: string | null;
  created_at: string;
}

export function useFicheTicketsRT(assetId: string) {
  return useQuery({
    queryKey: ['fiche-tickets-rt', assetId],
    queryFn: async (): Promise<TicketRT[]> => {
      const { data, error } = await supabase
        .from('fiche_tickets_rt')
        .select('id,ticket_rt,note,technicien,created_at')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!assetId,
  });
}

export function useAddTicketRT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      asset_id: string;
      source: string;
      asset: string;
      ticket_rt: string;
      note?: string;
      technicien?: string;
    }) => {
      const { error } = await supabase.from('fiche_tickets_rt').insert(payload);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['fiche-tickets-rt', variables.asset_id] });
    },
  });
}
