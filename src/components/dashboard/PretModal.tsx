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
import { Search, Handshake } from "lucide-react";

type Step = "asset" | "utilisateur" | "confirm";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PretModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState("");
  const [utilisateur, setUtilisateur] = useState("");
  const [foundName, setFoundName] = useState("");
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("nom, service, asset")
        .eq("asset", assetCode.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pretMutation = useMutation({
    mutationFn: async ({ assetCode, user }: { assetCode: string; user: string }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ pret: true, pret_utilisateur: user.trim() })
        .eq("asset", assetCode.trim());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`PC ${asset.trim()} mis en prêt pour ${utilisateur.trim()}`);
      handleClose();
    },
    onError: () => {
      toast.error("Erreur lors de la mise en prêt");
    },
  });

  const handleClose = () => {
    setStep("asset");
    setAsset("");
    setUtilisateur("");
    setFoundName("");
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (result) {
      setFoundName(`${result.nom} — ${result.service}`);
      setStep("utilisateur");
    } else {
      toast.error(`Aucun équipement trouvé avec l'asset "${asset.trim()}"`);
    }
  };

  const handleConfirm = () => {
    pretMutation.mutate({ assetCode: asset, user: utilisateur });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "asset" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake size={18} className="text-blue-500" />
                PC en prêt — Étape 1/2
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset du PC à mettre en prêt.
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
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleSearch}
                disabled={!asset.trim() || lookupMutation.isPending}
              >
                <Search size={14} />
                Rechercher
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "utilisateur" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake size={18} className="text-blue-500" />
                PC en prêt — Étape 2/2
              </DialogTitle>
              <DialogDescription>
                PC trouvé. Saisissez le nom de l'utilisateur qui emprunte ce PC.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Asset : <span className="font-mono text-primary">{asset.trim()}</span>
              </p>
              <p className="text-sm text-muted-foreground">{foundName}</p>
            </div>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Nom de l'utilisateur"
                value={utilisateur}
                onChange={(e) => setUtilisateur(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && utilisateur.trim() && setStep("confirm")}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("asset")}>
                Retour
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={!utilisateur.trim()}
              >
                Suivant
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Handshake size={18} />
                Confirmer le prêt
              </DialogTitle>
              <DialogDescription>
                Vérifiez les informations avant de confirmer.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Asset : <span className="font-mono text-primary">{asset.trim()}</span>
              </p>
              <p className="text-sm text-muted-foreground">{foundName}</p>
              <p className="text-sm font-medium text-foreground">
                Emprunté par : <span className="text-blue-600 dark:text-blue-400">{utilisateur.trim()}</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("utilisateur")}>
                Retour
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={pretMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Handshake size={14} />
                {pretMutation.isPending ? "Enregistrement…" : "Confirmer le prêt"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PretModal;
