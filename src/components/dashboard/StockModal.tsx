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

interface Props {
  open: boolean;
  onClose: () => void;
}

const StockModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState("");
  const [foundInfo, setFoundInfo] = useState("");
  const [foundRow, setFoundRow] = useState<Record<string, unknown> | null>(null);
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("asset", assetCode.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!foundRow) throw new Error("Aucune donnée trouvée");

      // Insert into stock_inventory (clearing user-related fields)
      const { error: insertError } = await supabase
        .from("stock_inventory")
        .insert({
          asset: foundRow.asset as string,
          sn: foundRow.sn as string ?? "",
          type: foundRow.type as string ?? "portable",
          dns: foundRow.dns as string ?? "",
          windows_version: foundRow.windows_version as string ?? "",
          eset_app: foundRow.eset_app as string ?? null,
          remarques: foundRow.remarques as string ?? null,
          nom: "",
          uid: null,
          matricule: null,
          pseudo: null,
          service: "",
          absence: false,
          pret: false,
          pret_utilisateur: "",
        });
      if (insertError) throw insertError;

      // Delete from inventory_items
      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .eq("asset", (foundRow.asset as string).trim());
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      toast.success(`Asset ${asset.trim()} déplacé vers le stock`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(`Erreur lors du déplacement vers le stock : ${err.message}`);
    },
  });

  const handleClose = () => {
    setStep("asset");
    setAsset("");
    setFoundInfo("");
    setFoundRow(null);
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (result) {
      setFoundRow(result as Record<string, unknown>);
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
              <DialogDescription>
                Saisissez le numéro d'asset à déplacer vers le stock.
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
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Archive size={18} />
                Confirmer le déplacement vers le stock
              </DialogTitle>
              <DialogDescription>
                L'asset sera retiré du Siège et transféré dans la table Stock. Les informations collaborateur seront effacées.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Asset : <span className="font-mono text-primary">{asset.trim()}</span>
              </p>
              <p className="text-sm text-muted-foreground">{foundInfo}</p>
              <p className="text-sm font-medium text-foreground">
                Destination : <span className="text-slate-600 dark:text-slate-400">Onglet Stock</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("asset")}>Retour</Button>
              <Button
                onClick={() => moveMutation.mutate()}
                disabled={moveMutation.isPending}
                className="bg-slate-600 hover:bg-slate-700 text-white"
              >
                <Archive size={14} />
                {moveMutation.isPending ? "Déplacement…" : "Confirmer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockModal;
