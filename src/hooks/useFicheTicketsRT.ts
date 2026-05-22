import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Recherche live RT (5 derniers tickets asset/user) ────────────────────────

export interface RTTicketSummary {
  id: string;
  subject: string;
  status: string;
  owner: string;
  queue: string;
  requestors: string;
  created: string;
  lastUpdated: string;
}

export function useRTSearch(asset: string | null, uid: string | null, nom: string | null) {
  const params = new URLSearchParams();
  if (asset) params.set('asset', asset);
  if (uid)   params.set('uid', uid);
  if (nom)   params.set('nom', nom);

  return useQuery<RTTicketSummary[]>({
    queryKey: ['rt-search', asset, uid, nom],
    queryFn: async () => {
      const res = await fetch(`/api/rt/search?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(asset || uid || nom),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

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
