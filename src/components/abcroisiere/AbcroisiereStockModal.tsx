import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Archive } from "lucide-react";

type Step = "asset" | "confirm";

interface Props { open: boolean; onClose: () => void; }

const AbcroisiereStockModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState("");
  const [foundInfo, setFoundInfo] = useState("");
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("abcroisiere_inventory").select("nom, service, asset").eq("asset", assetCode.trim()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const stockMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { error } = await supabase.from("abcroisiere_inventory").update({
        matricule: null, pseudo: null, absence: false, nom: "", uid: null, service: "Stock",
      }).eq("asset", assetCode.trim());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abcroisiere_inventory"] });
      toast.success(`Asset ${asset.trim()} mis en stock`);
      handleClose();
    },
    onError: () => { toast.error("Erreur lors de la mise en stock"); },
  });

  const handleClose = () => {
    setStep("asset"); setAsset(""); setFoundInfo(""); lookupMutation.reset(); onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (result) {
      setFoundInfo(`${result.nom || "(sans nom)"} — ${result.service || "(sans service)"}`);
      setStep("confirm");
    } else {
      toast.error(`Aucun équipement trouvé avec l'asset "${asset.trim()}"`);
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
                Mettre en stock
              </DialogTitle>
              <DialogDescription>Saisissez le numéro d'asset à mettre en stock.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Numéro d'asset (ex: ABC12345)" value={asset}
                onChange={(e) => setAsset(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSearch} disabled={!asset.trim() || lookupMutation.isPending}>
                <Search size={14} />Rechercher
              </Button>
            </DialogFooter>
          </>
        )}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Archive size={18} />Confirmer la mise en stock
              </DialogTitle>
              <DialogDescription>
                Les champs matricule, pseudo, absence, nom et UID seront vidés. Le service sera remplacé par "Stock".
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Asset : <span className="font-mono text-primary">{asset.trim()}</span>
              </p>
              <p className="text-sm text-muted-foreground">{foundInfo}</p>
              <p className="text-sm font-medium text-foreground">
                Nouveau service : <span className="text-slate-600 dark:text-slate-400">Stock</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("asset")}>Retour</Button>
              <Button onClick={() => stockMutation.mutate(asset)} disabled={stockMutation.isPending} className="bg-slate-600 hover:bg-slate-700 text-white">
                <Archive size={14} />{stockMutation.isPending ? "Enregistrement…" : "Confirmer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AbcroisiereStockModal;
