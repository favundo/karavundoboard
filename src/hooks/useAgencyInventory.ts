import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgencyItem = {
  id?: string;
  sous_reseau: string;
  masque: string;
  agence: string;
  asset: string;
  sn: string;
  os_version: string;
};

export const useAgencyInventory = () => {
  return useQuery({
    queryKey: ["agency_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_inventory")
        .select("*")
        .order("agence", { ascending: true });
      if (error) throw error;
      return data as AgencyItem[];
    },
  });
};

// Append new items to existing agency inventory (no deletion)
export const useAppendAgencyInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: AgencyItem[]) => {
      if (items.length === 0) return;

      const batchSize = 500;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("agency_inventory")
          .insert(batch);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_inventory"] });
    },
  });
};

// Keep for backward compatibility
export const useReplaceAgencyInventory = useAppendAgencyInventory;
