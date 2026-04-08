import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none";

interface Props {
  open: boolean;
  onClose: () => void;
  agences: string[];
  onSupprimer: (agence: string) => void;
}

const AgencySupprimerAgenceModal = ({ open, onClose, agences, onSupprimer }: Props) => {
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleClose = () => {
    setSelected("");
    setConfirming(false);
    onClose();
  };

  const handleValider = () => {
    if (!selected) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    onSupprimer(selected);
    toast.success(`Agence "${selected}" supprimée de la liste`);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Supprimer une agence</DialogTitle>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="py-2 space-y-1">
              <Label>Agence à supprimer</Label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">— Choisir —</option>
                {agences.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button variant="destructive" disabled={!selected} onClick={handleValider}>
                Supprimer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-2 text-sm text-muted-foreground">
              Confirmer la suppression de l'agence{" "}
              <span className="font-semibold text-foreground">"{selected}"</span> de la liste déroulante ?
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>Retour</Button>
              <Button variant="destructive" onClick={handleConfirm}>Confirmer</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgencySupprimerAgenceModal;
