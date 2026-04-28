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
import { AlertTriangle, Search, Trash2 } from "lucide-react";

type Step = "input" | "confirm";

interface Props {
  open: boolean;
  onClose: () => void;
}

const StockDecommissionModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("input");
  const [asset, setAsset] = useState("");
  const [foundName, setFoundName] = useState("");
  const [foundSn, setFoundSn] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("stock_inventory")
        .select("nom, asset, sn")
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
        .insert({ asset: assetCode, serial_number: foundSn, source: "stock" });
      if (insertError) throw insertError;
      const { error } = await supabase
        .from("stock_inventory")
        .delete()
        .eq("asset", assetCode.trim());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
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
    setFoundName("");
    setFoundSn(null);
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (result) {
      setFoundName(result.nom ? `Affecté à : ${result.nom}` : "Non affecté (disponible)");
      setFoundSn(result.sn ?? null);
      setStep("confirm");
    } else {
      toast.error(`Aucun équipement trouvé dans le stock avec l'asset "${asset.trim()}"`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "input" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 size={18} className="text-destructive" />
                Décommissionner un PC du stock
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset de l'équipement à retirer du stock.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Numéro d'asset (ex: ABC12345)"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSearch} disabled={!asset.trim() || lookupMutation.isPending}>
                <Search size={14} />
                Rechercher
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} />
                Confirmer la suppression
              </DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir décommissionner cet équipement ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Asset : <span className="font-mono text-primary">{asset.trim()}</span>
              </p>
              <p className="text-sm text-muted-foreground">{foundName}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}>Retour</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(asset.trim())}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={14} />
                {deleteMutation.isPending ? "Suppression…" : "Confirmer la suppression"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockDecommissionModal;
