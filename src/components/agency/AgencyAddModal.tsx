import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

const AGENCES = [
  "Albi","Arcachon","Aulnay-sous-bois","Aurillac","Auxerre","Begles",
  "Bordeaux Meriadeck","Bourges","Brest","Brestphare","Bretigny","Cergy",
  "Cesson Bois-senart","Champfleury","Claye Souilly","Clermont-Ferrand",
  "Collegien Bay2","Creil","Creteil","Dieppe","Dijon","Dreux","Englos",
  "Epernay","Evry2","Farebersviller","Flins","Fontenay-sous-Bois","Glissy",
  "Grenoble","Herouville-saint-Clair","La Defense","Lanester","Le Havre",
  "Le Mans","Leers","Lens","Les Ulis","Lieussaint Carre-Senart",
  "Lille Euralille","Louvroil","Lyon Part-Dieu","Lyon Victor-Hugo",
  "Mandelieu-La-Napoule","Marsac-Perigueux","Marseille Grand Littoral",
  "Marseille TDP","Maurepas","Meaux","Montesson","Nancy","Nantes Cassard",
  "Noisy","Orange","Orleans","Orvault","Paris Bonne-Nouvelle",
  "Paris Chaussee Antin","Paris Sebastopol","Paris Voltaire","PERPIGNAN",
  "Plaisir","Poitiers","Quimper","Rennes","Roissy","Roncq","Rosny2","Rouen",
  "Saint-Avold","Saint-Etienne Centre2","Saint-Genis","Saint-Gregoire",
  "Saint-Laurent-du-Var","Saint-Martin-Boulogne","Saint-Orens",
  "Saint-Pierre-d-Irube","Saint-Priest","Saint-Quentin","Soissons",
  "Thiais Belle-Epine","Toulon","Toulouse","Tours","Val d'europe",
  "Valenciennes","Velizy","Villeneuve-d-Asq","Villeneuve-la-Garenne Qwartz",
  "Villiers-en-biere","Vitrolles",
];

interface FormData {
  agence: string;
  type: string;
  asset: string;
  sn: string;
  os_version: string;
  eset_app: string;
}

const EMPTY: FormData = {
  agence: "", type: "", asset: "", sn: "", os_version: "", eset_app: "",
};

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none";

interface Props {
  open: boolean;
  onClose: () => void;
  extraAgences?: string[];
}

const AgencyAddModal = ({ open, onClose, extraAgences = [] }: Props) => {
  const allAgences = extraAgences.length ? extraAgences : AGENCES.sort();
  const [form, setForm] = useState<FormData>(EMPTY);
  const queryClient = useQueryClient();

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const isValid =
    form.agence && form.type && form.asset.trim() &&
    form.sn.trim() && form.os_version && form.eset_app;

  const insertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agency_inventory").insert({
        agence: form.agence,
        type: form.type,
        asset: form.asset.trim(),
        sn: form.sn.trim(),
        os_version: form.os_version,
        eset_app: form.eset_app,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_inventory"] });
      toast.success(`Asset ${form.asset.trim()} ajouté avec succès`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });

  const handleClose = () => {
    setForm(EMPTY);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un équipement agence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Agence <span className="text-destructive">*</span></Label>
            <select value={form.agence} onChange={set("agence")} className={SELECT_CLASS}>
              <option value="">— Choisir —</option>
              {allAgences.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type <span className="text-destructive">*</span></Label>
              <select value={form.type} onChange={set("type")} className={SELECT_CLASS}>
                <option value="">— Choisir —</option>
                <option>AIO</option>
                <option>Tour</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Asset <span className="text-destructive">*</span></Label>
              <Input value={form.asset} onChange={set("asset")} placeholder="ex: AGE-001" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Numéro de série <span className="text-destructive">*</span></Label>
            <Input value={form.sn} onChange={set("sn")} placeholder="SN" className="font-mono text-xs" />
          </div>

          <div className="space-y-1">
            <Label>Version de l'OS <span className="text-destructive">*</span></Label>
            <select value={form.os_version} onChange={set("os_version")} className={SELECT_CLASS}>
              <option value="">— Choisir —</option>
              <option>Microsoft Windows 11 Professionnel</option>
              <option>Microsoft Windows 11 Professionnel N</option>
              <option>Microsoft Windows 10 Professionnel</option>
              <option>Microsoft Windows 10 Professionnel N</option>
              <option>Linux</option>
              <option>Autres</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>App. ESET <span className="text-destructive">*</span></Label>
            <select value={form.eset_app} onChange={set("eset_app")} className={SELECT_CLASS}>
              <option value="">— Choisir —</option>
              <option>ESET Endpoint Security</option>
              <option>ESET Endpoint ANTIVIRUS</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button
            disabled={!isValid || insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
          >
            {insertMutation.isPending ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgencyAddModal;
