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
import { Label } from "@/components/ui/label";
import { Search, UserCheck, AlertTriangle } from "lucide-react";

type Step = "asset" | "form";

interface FormData {
  nom: string;
  uid: string;
  matricule: string;
  pseudo: string;
  service: string;
  type: string;
  sn: string;
  dns: string;
  windows_version: string;
  remarques: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const AffecterModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState("");
  const [alreadyAssigned, setAlreadyAssigned] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    nom: "", uid: "", matricule: "", pseudo: "",
    service: "", type: "", sn: "", dns: "",
    windows_version: "", remarques: "",
  });
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("nom, uid, matricule, pseudo, service, type, sn, dns, windows_version, remarques, asset")
        .eq("asset", assetCode.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          nom: form.nom.trim(),
          uid: form.uid.trim(),
          matricule: form.matricule.trim(),
          pseudo: form.pseudo.trim(),
          service: form.service.trim(),
          type: form.type,
          sn: form.sn.trim(),
          dns: form.dns.trim(),
          windows_version: form.windows_version.trim(),
          remarques: form.remarques.trim(),
        })
        .eq("asset", asset.trim());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`Asset ${asset.trim()} affecté à ${form.nom.trim()} (${form.uid.trim()})`);
      handleClose();
    },
    onError: () => {
      toast.error("Erreur lors de l'affectation");
    },
  });

  const handleClose = () => {
    setStep("asset");
    setAsset("");
    setAlreadyAssigned(null);
    setForm({ nom: "", uid: "", matricule: "", pseudo: "", service: "", type: "", sn: "", dns: "", windows_version: "", remarques: "" });
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (!result) {
      toast.error(`Aucun équipement trouvé avec l'asset "${asset.trim()}"`);
      return;
    }

    // Already assigned?
    if (result.nom && result.nom.trim() !== "") {
      const who = result.uid ? `${result.nom} (${result.uid})` : result.nom;
      setAlreadyAssigned(who);
    } else {
      setAlreadyAssigned(null);
    }

    setForm({
      nom: result.nom ?? "",
      uid: result.uid ?? "",
      matricule: result.matricule ?? "",
      pseudo: result.pseudo ?? "",
      service: result.service ?? "",
      type: result.type ?? "",
      sn: result.sn ?? "",
      dns: result.dns ?? "",
      windows_version: result.windows_version ?? "",
      remarques: result.remarques ?? "",
    });
    setStep("form");
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSave = form.nom.trim() !== "" && form.uid.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {step === "asset" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck size={18} className="text-violet-500" />
                Affecter un PC — Étape 1/2
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset du PC à affecter.
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

        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck size={18} className="text-violet-500" />
                Affecter — <span className="font-mono text-primary">{asset.trim()}</span>
              </DialogTitle>
              <DialogDescription>
                Modifiez les informations. <span className="text-foreground font-medium">Nom</span> et <span className="text-foreground font-medium">UID</span> sont obligatoires.
              </DialogDescription>
            </DialogHeader>

            {alreadyAssigned && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-600 dark:text-orange-400">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Cet asset est déjà affecté à <span className="font-semibold">{alreadyAssigned}</span>. Vous pouvez tout de même modifier l'affectation.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 py-1 max-h-[60vh] overflow-y-auto pr-1">
              <div className="col-span-2 space-y-1">
                <Label>Nom <span className="text-destructive">*</span></Label>
                <Input value={form.nom} onChange={set("nom")} placeholder="Nom complet" autoFocus />
              </div>
              <div className="space-y-1">
                <Label>UID <span className="text-destructive">*</span></Label>
                <Input value={form.uid} onChange={set("uid")} placeholder="uid" />
              </div>
              <div className="space-y-1">
                <Label>Matricule</Label>
                <Input value={form.matricule} onChange={set("matricule")} placeholder="Matricule" />
              </div>
              <div className="space-y-1">
                <Label>Pseudo</Label>
                <Input value={form.pseudo} onChange={set("pseudo")} placeholder="Pseudo" />
              </div>
              <div className="space-y-1">
                <Label>Service</Label>
                <select
                  value={form.service}
                  onChange={set("service")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option>Administration et Finance</option>
                  <option>Agence</option>
                  <option>Comex</option>
                  <option>Communication et Design</option>
                  <option>Data Client</option>
                  <option>Direction Produit</option>
                  <option>Externe</option>
                  <option>Fram</option>
                  <option>Groupes</option>
                  <option>Groupes - Plateforme Lille</option>
                  <option>Groupes - Plateforme Nord</option>
                  <option>Indiv CE</option>
                  <option>Informatique</option>
                  <option>Juridique</option>
                  <option>Marketing</option>
                  <option>Présidence</option>
                  <option>Production</option>
                  <option>Qualité</option>
                  <option>Relation Client</option>
                  <option>Ressources Humaines</option>
                  <option>Stock</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  value={form.type}
                  onChange={set("type")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option value="portable">Portable</option>
                  <option value="Pc Fixe">PC Fixe</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>N° Série</Label>
                <Input value={form.sn} onChange={set("sn")} placeholder="SN" className="font-mono text-xs" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>NOM DNS</Label>
                <Input value={form.dns} onChange={set("dns")} placeholder="host.domaine.com" className="font-mono text-xs" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Version Windows</Label>
                <select
                  value={form.windows_version}
                  onChange={set("windows_version")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option>Microsoft Windows 11 Professionnel</option>
                  <option>Microsoft Windows 11 Professionnel N</option>
                  <option>Microsoft Windows 10 Professionnel</option>
                  <option>Microsoft Windows 10 Professionnel N</option>
                  <option>Linux</option>
                  <option>Autres</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Remarques</Label>
                <textarea
                  value={form.remarques}
                  onChange={set("remarques")}
                  rows={2}
                  placeholder="Remarques éventuelles"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("asset")}>Retour</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <UserCheck size={14} />
                {saveMutation.isPending ? "Enregistrement…" : "Affecter"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AffecterModal;
