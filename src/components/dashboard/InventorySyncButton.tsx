import { RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminOnly } from "@/components/AdminOnly";
import { useInventorySync, useLastInventorySync, type InventorySyncRun } from "@/hooks/useInventorySync";

/**
 * Bouton « Maj » du camembert Versions Windows.
 *
 * Lui seul : la synchro ne couvre que l'OS, ESET ne publiant pas le produit
 * installé (voir CLAUDE.md). Un bouton sur le camembert « Type app. ESET »
 * promettrait une mise à jour qui n'arriverait jamais.
 *
 * La passe de nuit suffit au quotidien ; ce bouton sert au cas où l'on vient
 * justement de remasteriser un poste et qu'on ne veut pas attendre 2h30.
 *
 * Réservé aux administrateurs : l'action réécrit une colonne sur tout
 * l'inventaire du siège. Le masquage ici n'est que le premier rideau — le
 * refus réel vient du serveur, qui lit Remote-Groups (voir CLAUDE.md).
 */
export const InventorySyncButton = () => {
  const sync = useInventorySync();

  const run = () => {
    if (sync.isPending) return;
    toast.promise(sync.mutateAsync(), {
      loading: "Interrogation d'ESET et d'OCS…",
      success: (r: InventorySyncRun) =>
        `${r.matched} postes retrouvés, ${r.updated} mis à jour` +
        (r.unmatched ? ` — ${r.unmatched} introuvables` : ""),
      error: (e: Error) => e.message,
    });
  };

  return (
    <AdminOnly>
      <button
        onClick={run}
        disabled={sync.isPending}
        title="Reprendre les versions de Windows depuis ESET et OCS"
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw size={12} className={sync.isPending ? "animate-spin" : undefined} />
        Maj
      </button>
    </AdminOnly>
  );
};

const formatRunDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

/**
 * Fraîcheur de la donnée, sous le titre du camembert.
 *
 * Affiche l'échec et la source muette, pas seulement la date : une passe qui
 * s'est bien déroulée sur zéro device ESET rend exactement le même « 0 mis à
 * jour » qu'un parc déjà à jour. Sans ce signal, une panne d'ESET se lirait
 * comme un parc stable — ce qui a coûté trois journées de téléphonie.
 */
export const LastSyncLabel = () => {
  const { data: run } = useLastInventorySync();
  if (!run) return null;

  if (run.error_message) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <AlertTriangle size={11} /> synchro en échec le {formatRunDate(run.started_at)}
      </span>
    );
  }

  if (run.eset_devices === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <AlertTriangle size={11} /> ESET muet le {formatRunDate(run.started_at)}
      </span>
    );
  }

  return <span>synchro {formatRunDate(run.started_at)}</span>;
};
