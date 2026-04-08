import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Archive } from "lucide-react";

type Step = "asset" | "confirm";

interface AgencyRecord {
  asset: string;
  sn: string;
  os_version: string;
  eset_app: string | null;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const AgencyStockModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [assetInput, setAssetInput] = useState("");
  const [found, setFound] = useState<AgencyRecord | null>(null);
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("agency_inventory")
        .select("asset, sn, os_version, eset_app, type")
        .eq("asset", assetCode)
        .maybeSingle();
      if (error) throw error;
      return data as AgencyRecord | null;
    },
  });

  const stockMutation = useMutation({
    mutationFn: async (record: AgencyRecord) => {
      // 1. Créer dans inventory_items
      const { error: insertError } = await supabase.from("inventory_items").insert({
        asset: record.asset,
        sn: record.sn,
        windows_version: record.os_version,
        eset_app: record.eset_app,
        type: "Pc Fixe",
        service: "Stock",
        nom: "",
      });
      if (insertError) throw insertError;

      // 2. Supprimer de agency_inventory
      const { error: deleteError } = await supabase
        .from("agency_inventory")
        .delete()
        .eq("asset", record.asset);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`Asset ${found?.asset} transféré en stock siège`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });

  const handleClose = () => {
    setStep("asset");
    setAssetInput("");
    setFound(null);
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    const code = assetInput.trim();
    if (!code) return;
    const result = await lookupMutation.mutateAsync(code);
    if (result) {
      setFound(result);
      setStep("confirm");
    } else {
      toast.error(`Aucun équipement trouvé avec l'asset "${code}"`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "asset" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive size={18} className="text-slate-500" />
                Mettre en stock — Siège
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset à transférer vers le stock siège.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                autoFocus
                placeholder="Numéro d'asset"
                value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSearch} disabled={!assetInput.trim() || lookupMutation.isPending}>
                <Search size={14} />
                Rechercher
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && found && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Archive size={18} />
                Confirmer le transfert en stock
              </DialogTitle>
              <DialogDescription>
                L'équipement sera supprimé du parc agences et créé dans l'inventaire siège avec le service "Stock".
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset</span>
                <span className="font-mono font-medium text-primary">{found.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">N° de série</span>
                <span className="font-mono">{found.sn || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version OS</span>
                <span>{found.os_version || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">App. ESET</span>
                <span>{found.eset_app || "—"}</span>
              </div>
              <div className="flex justify-between border-t border-slate-500/20 pt-2 mt-2">
                <span className="text-muted-foreground">Service destination</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Stock</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("asset")}>Retour</Button>
              <Button
                onClick={() => stockMutation.mutate(found)}
                disabled={stockMutation.isPending}
                className="bg-slate-600 hover:bg-slate-700 text-white"
              >
                <Archive size={14} />
                {stockMutation.isPending ? "Transfert…" : "Confirmer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgencyStockModal;
