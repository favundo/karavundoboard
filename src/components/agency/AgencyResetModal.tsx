import { useState } from "react";
import { Trash2, X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AgencyResetModalProps {
  open: boolean;
  onClose: () => void;
}

const AgencyResetModal = ({ open, onClose }: AgencyResetModalProps) => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  const handleReset = async () => {
    setLoading(true);
    await supabase.from("agency_inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    queryClient.invalidateQueries({ queryKey: ["agency_inventory"] });
    setLoading(false);
    setDone(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 size={16} />
            </div>
            <p className="text-sm font-semibold text-foreground">Vider l'inventaire</p>
          </div>
          <button onClick={handleClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!done ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  Cette action supprimera <strong>définitivement</strong> tous les équipements de l'onglet <strong>Réseau Agences</strong>. Cette opération est irréversible.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleClose} className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Annuler
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {loading ? "Suppression…" : "Vider l'inventaire"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Trash2 size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Inventaire vidé</p>
                <p className="mt-1 text-xs text-muted-foreground">Toutes les données ont été supprimées.</p>
              </div>
              <button onClick={handleClose} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyResetModal;
