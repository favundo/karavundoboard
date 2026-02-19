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

export const useReplaceAgencyInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: AgencyItem[]) => {
      // Delete all existing records
      const { error: deleteError } = await supabase
        .from("agency_inventory")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) throw deleteError;

      if (items.length === 0) return;

      // Insert new records in batches of 500
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
