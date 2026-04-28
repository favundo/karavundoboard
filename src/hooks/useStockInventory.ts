import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dbToInventoryItem, type DbInventoryItem } from "./useInventory";
import { type InventoryItem } from "@/data/inventoryData";

export const useStockInventory = () => {
  return useQuery({
    queryKey: ["stock-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_inventory")
        .select("*")
        .order("asset", { ascending: true });
      if (error) throw error;
      return (data as DbInventoryItem[]).map(dbToInventoryItem);
    },
  });
};

export const useAppendStockInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: InventoryItem[]) => {
      const BATCH = 200;
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH).map((item) => ({
          matricule: item.matricule ?? "",
          pseudo: item.pseudo ?? "",
          nom: item.nom ?? "",
          uid: item.uid ?? "",
          service: "",
          type: item.type ?? "portable",
          asset: item.asset || `EMPTY-${crypto.randomUUID()}`,
          sn: item.sn ?? "",
          dns: item.dns ?? "",
          absence: item.absence ?? false,
          remarques: item.remarques ?? "",
          windows_version: item.windows_version ?? "",
          eset_app: item.eset_app ?? "",
        }));
        const { error } = await supabase
          .from("stock_inventory")
          .upsert(batch, { onConflict: "asset", ignoreDuplicates: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
    },
  });
};
