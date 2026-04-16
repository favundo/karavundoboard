import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, X, Check, Save } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  siege: "Siège",
  agences: "Agences",
  abcroisiere: "ABcroisière",
};

const DecommissionedListModal = ({ open, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["decommissioned_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decommissioned_items")
        .select("*")
        .eq("traite", false)
        .order("decommissioned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, traite }: { id: string; traite: boolean }) => {
      const { error } = await supabase
        .from("decommissioned_items")
        .update({ traite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["decommissioned_items"] });
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast.success("Statut sauvegardé");
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  const handleToggle = (id: string, currentTraite: boolean) => {
    const base = pendingChanges[id] !== undefined ? pendingChanges[id] : currentTraite;
    setPendingChanges((prev) => ({ ...prev, [id]: !base }));
  };

  const handleSave = (id: string, currentTraite: boolean) => {
    const value = pendingChanges[id] !== undefined ? pendingChanges[id] : currentTraite;
    saveMutation.mutate({ id, traite: value });
  };

  const getTraite = (id: string, currentTraite: boolean) =>
    pendingChanges[id] !== undefined ? pendingChanges[id] : currentTraite;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">PC Décommissionnés</p>
              <p className="text-xs text-muted-foreground">{items.length} équipement{items.length !== 1 ? "s" : ""} au total</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Trash2 size={32} className="opacity-20" />
              <p className="text-sm">Aucun PC décommissionné pour le moment</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">N° de série</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Onglet</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Traité</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const traite = getTraite(item.id, item.traite);
                  const isDirty = pendingChanges[item.id] !== undefined;
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{item.asset}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{item.serial_number ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.decommissioned_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(item.id, item.traite)}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors mx-auto ${
                            traite
                              ? "bg-green-500/20 border-green-500/40 text-green-600 dark:text-green-400"
                              : "bg-muted border-border text-transparent hover:border-muted-foreground"
                          }`}
                        >
                          <Check size={12} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSave(item.id, item.traite)}
                          disabled={!isDirty || saveMutation.isPending}
                          className="inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-30 enabled:bg-primary/10 enabled:text-primary enabled:hover:bg-primary/20"
                        >
                          <Save size={11} />
                          Sauvegarder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecommissionedListModal;
