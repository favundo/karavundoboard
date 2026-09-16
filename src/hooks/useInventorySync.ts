import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** Une passe de synchronisation, telle que la stocke `inventory_sync_runs`. */
export interface InventorySyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  table_name: string;
  trigger: "cron" | "manual";
  uid_declencheur: string | null;
  /** Volume rendu par ESET avant rapprochement — 0 signale une panne, pas un parc vide. */
  eset_devices: number;
  ocs_lookups: number;
  matched: number;
  updated: number;
  unmatched: number;
  error_message: string | null;
}

/**
 * Dernière passe connue, pour dater les camemberts.
 *
 * Passe par l'API Express et non par PostgREST : c'est elle qui écrit la table,
 * et le front n'a besoin que de la dernière ligne.
 */
export const useLastInventorySync = () =>
  useQuery<InventorySyncRun | null>({
    queryKey: ["inventory-sync-last"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/sync/last");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: false,
  });

/**
 * Déclenche une passe immédiate.
 *
 * Le refus d'un non-administrateur vient du serveur (403) : l'appel traverse
 * l'API Express, qui lit Remote-Groups. Le masquage par <AdminOnly> côté
 * interface n'est que le premier rideau.
 */
export const useInventorySync = () => {
  const queryClient = useQueryClient();
  return useMutation<InventorySyncRun, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/inventory/sync", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Erreur de synchronisation");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sync-last"] });
    },
  });
};
