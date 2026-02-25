import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type InventoryItem } from "@/data/inventoryData";

export type DbInventoryItem = {
  id: string;
  matricule: string;
  pseudo: string;
  nom: string;
  uid: string;
  service: string;
  type: string;
  asset: string;
  sn: string;
  dns: string;
  absence: boolean;
  remarques: string;
  windows_version: string;
  created_at: string;
  updated_at: string;
};

// Map DB row → InventoryItem (for compatibility with existing components)
export const dbToInventoryItem = (row: DbInventoryItem): InventoryItem => ({
  matricule: row.matricule ?? "",
  pseudo: row.pseudo ?? "",
  nom: row.nom ?? "",
  uid: row.uid ?? "",
  service: row.service ?? "",
  type: (row.type === "Pc Fixe" ? "Pc Fixe" : "portable") as "portable" | "Pc Fixe",
  asset: row.asset ?? "",
  sn: row.sn ?? "",
  dns: row.dns ?? "",
  absence: row.absence ?? false,
  remarques: row.remarques ?? "",
  windows_version: row.windows_version ?? "",
});

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("nom", { ascending: true });
      if (error) throw error;
      return (data as DbInventoryItem[]).map(dbToInventoryItem);
    },
  });
};

// Append new items to existing inventory (no deletion)
export const useAppendInventory = () => {
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
          service: item.service ?? "",
          type: item.type ?? "portable",
          asset: item.asset ?? "",
          sn: item.sn ?? "",
          dns: item.dns ?? "",
          absence: item.absence ?? false,
          remarques: item.remarques ?? "",
          windows_version: item.windows_version ?? "",
        }));
        // Upsert: if asset already exists, update all other fields
        const { error: insertError } = await supabase
          .from("inventory_items")
          .upsert(batch, { onConflict: "asset", ignoreDuplicates: false });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};

// Keep for backward compatibility (full replace)
export const useReplaceInventory = useAppendInventory;
