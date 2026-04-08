import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (agence: string) => void;
}

const AgencyNouvelleAgenceModal = ({ open, onClose, onAdd }: Props) => {
  const [nom, setNom] = useState("");

  const handleClose = () => {
    setNom("");
    onClose();
  };

  const handleSubmit = () => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    toast.success(`Agence "${trimmed}" ajoutée à la liste`);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvelle agence</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-1">
          <Label>Nom de l'agence <span className="text-destructive">*</span></Label>
          <Input
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex: Bordeaux Centre"
            onKeyDown={(e) => e.key === "Enter" && nom.trim() && handleSubmit()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button disabled={!nom.trim()} onClick={handleSubmit}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgencyNouvelleAgenceModal;
