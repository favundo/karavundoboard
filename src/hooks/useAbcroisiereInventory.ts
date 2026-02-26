import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { triggerWebhook } from "@/lib/zapierWebhook";
import { type InventoryItem } from "@/data/inventoryData";

export type DbAbcroisiereItem = {
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

export const dbToInventoryItem = (row: DbAbcroisiereItem): InventoryItem => ({
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

export const useAbcroisiereInventory = () => {
  return useQuery({
    queryKey: ["abcroisiere_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abcroisiere_inventory")
        .select("*")
        .order("nom", { ascending: true });
      if (error) throw error;
      return (data as DbAbcroisiereItem[]).map(dbToInventoryItem);
    },
  });
};

// Append new items to existing inventory (no deletion)
export const useAppendAbcroisiereInventory = () => {
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
          asset: item.asset || `EMPTY-${crypto.randomUUID()}`,
          sn: item.sn ?? "",
          dns: item.dns ?? "",
          absence: item.absence ?? false,
          remarques: item.remarques ?? "",
          windows_version: item.windows_version ?? "",
        }));
        const { error: insertError } = await supabase
          .from("abcroisiere_inventory")
          .upsert(batch, { onConflict: "asset", ignoreDuplicates: false });
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["abcroisiere_inventory"] });
      triggerWebhook("import", { table: "ABcroisière", count: variables.length });
    },
  });
};

// Keep for backward compatibility
export const useReplaceAbcroisiereInventory = useAppendAbcroisiereInventory;
