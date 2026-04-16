import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Search, Trash2, X, MonitorX } from "lucide-react";

type Step = "input" | "confirm";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AgencyDecommissionModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("input");
  const [asset, setAsset] = useState("");
  const [foundInfo, setFoundInfo] = useState("");
  const [foundSn, setFoundSn] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("agency_inventory")
        .select("asset, agence, type, sn")
        .eq("asset", assetCode.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { error: insertError } = await supabase
        .from("decommissioned_items")
        .insert({ asset: assetCode, serial_number: foundSn, source: "agences" });
      if (insertError) throw insertError;
      const { error } = await supabase
        .from("agency_inventory")
        .delete()
        .eq("asset", assetCode.trim());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_inventory"] });
      toast.success(`Asset ${asset.trim()} décommissionné avec succès`);
      handleClose();
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const handleClose = () => {
    setStep("input");
    setAsset("");
    setFoundInfo("");
    setFoundSn(null);
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (result) {
      setFoundInfo(`${result.agence} — ${result.type}`);
      setFoundSn(result.sn ?? null);
      setStep("confirm");
    } else {
      toast.error(`Aucun équipement trouvé avec l'asset "${asset.trim()}"`);
    }
  };

  const handleConfirm = () => {
    deleteMutation.mutate(asset.trim());
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <MonitorX size={16} />
            </div>
            <p className="text-sm font-semibold text-foreground">Décommissionner un équipement</p>
          </div>
          <button onClick={handleClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "input" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Saisissez le numéro d'asset de l'équipement à retirer de l'inventaire agences.
              </p>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Numéro d'asset (ex: ABC12345)"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={handleClose} className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Annuler
                </button>
                <button
                  onClick={handleSearch}
                  disabled={!asset.trim() || lookupMutation.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Search size={14} />
                  {lookupMutation.isPending ? "Recherche…" : "Rechercher"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  Êtes-vous sûr de vouloir décommissionner cet équipement ? Cette action est <strong>irréversible</strong>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Asset : <span className="font-mono text-primary">{asset.trim()}</span>
                </p>
                <p className="text-xs text-muted-foreground">{foundInfo}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setStep("input")} className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Retour
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={deleteMutation.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {deleteMutation.isPending ? "Suppression…" : "Confirmer la suppression"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyDecommissionModal;
