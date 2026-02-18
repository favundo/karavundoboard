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

export const useReplaceInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: InventoryItem[]) => {
      // Delete all existing rows
      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
      if (deleteError) throw deleteError;

      // Insert new rows in batches of 200
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
        }));
        const { error: insertError } = await supabase.from("inventory_items").insert(batch);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
