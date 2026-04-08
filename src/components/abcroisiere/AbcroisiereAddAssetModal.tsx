import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, ArrowLeft } from "lucide-react";

type Step = "input" | "form";

interface FormData {
  asset: string; sn: string; type: string; dns: string; windows_version: string;
  eset_app: string; matricule: string; pseudo: string; service: string;
  absence: boolean; nom: string; uid: string; remarques: string;
}

const EMPTY_FORM: FormData = {
  asset: "", sn: "", type: "", dns: "", windows_version: "", eset_app: "",
  matricule: "", pseudo: "", service: "", absence: false, nom: "", uid: "", remarques: "",
};

interface Props { open: boolean; onClose: () => void; }

const AbcroisiereAddAssetModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("input");
  const [assetInput, setAssetInput] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const queryClient = useQueryClient();

  const checkMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("abcroisiere_inventory").select("asset").eq("asset", assetCode.trim()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const { error } = await supabase.from("abcroisiere_inventory").insert({
        asset: payload.asset.trim(), sn: payload.sn.trim(), type: payload.type.trim(),
        dns: payload.dns.trim(), windows_version: payload.windows_version.trim(),
        eset_app: payload.eset_app.trim() || null, matricule: payload.matricule.trim() || null,
        pseudo: payload.pseudo.trim() || null, service: payload.service.trim() || undefined,
        absence: payload.absence, nom: payload.nom.trim() || undefined,
        uid: payload.uid.trim() || null, remarques: payload.remarques.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abcroisiere_inventory"] });
      toast.success(`Asset ${form.asset.trim()} ajouté avec succès`);
      handleClose();
    },
    onError: (err: Error) => { toast.error(`Erreur lors de l'ajout : ${err.message}`); },
  });

  const handleClose = () => { setStep("input"); setAssetInput(""); setForm(EMPTY_FORM); checkMutation.reset(); onClose(); };

  const handleSearch = async () => {
    if (!assetInput.trim()) return;
    const existing = await checkMutation.mutateAsync(assetInput.trim());
    if (existing) { toast.error(`L'asset "${assetInput.trim()}" existe déjà dans l'inventaire`); }
    else { setForm({ ...EMPTY_FORM, asset: assetInput.trim() }); setStep("form"); }
  };

  const handleField = (field: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isFormValid = () =>
    form.asset.trim() && form.sn.trim() && form.type.trim() &&
    form.dns.trim() && form.windows_version.trim() && form.eset_app.trim();

  const SC = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {step === "input" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle size={18} className="text-green-600 dark:text-green-400" />
                Ajouter un asset
              </DialogTitle>
              <DialogDescription>Saisissez le numéro d'asset de l'équipement à ajouter.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Numéro d'asset (ex: ABC12345)" value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSearch} disabled={!assetInput.trim() || checkMutation.isPending}>
                <Search size={14} />Continuer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle size={18} className="text-green-600 dark:text-green-400" />
                Informations de l'asset
              </DialogTitle>
              <DialogDescription>Les champs marqués <span className="text-destructive">*</span> sont obligatoires.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>ASSET <span className="text-destructive">*</span></Label>
                <Input value={form.asset} readOnly className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sn">SN <span className="text-destructive">*</span></Label>
                  <Input id="sn" placeholder="Numéro de série" value={form.sn} onChange={(e) => handleField("sn", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="type">Type immo <span className="text-destructive">*</span></Label>
                  <select id="type" value={form.type} onChange={(e) => handleField("type", e.target.value)} className={SC}>
                    <option value="">— Choisir —</option>
                    <option value="portable">Portable</option>
                    <option value="Pc Fixe">Pc Fixe</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dns">NOM DNS <span className="text-destructive">*</span></Label>
                  <Input id="dns" placeholder="ex: PC-DUPONT" value={form.dns} onChange={(e) => handleField("dns", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="windows_version">Version de Windows <span className="text-destructive">*</span></Label>
                  <select id="windows_version" value={form.windows_version} onChange={(e) => handleField("windows_version", e.target.value)} className={SC}>
                    <option value="">— Choisir —</option>
                    <option>Microsoft Windows 11 Professionnel</option>
                    <option>Microsoft Windows 11 Professionnel N</option>
                    <option>Microsoft Windows 10 Professionnel</option>
                    <option>Microsoft Windows 10 Professionnel N</option>
                    <option>Linux</option>
                    <option>Autres</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eset_app">App. ESET <span className="text-destructive">*</span></Label>
                <select id="eset_app" value={form.eset_app} onChange={(e) => handleField("eset_app", e.target.value)} className={SC}>
                  <option value="">— Choisir —</option>
                  <option>ESET Endpoint Security</option>
                  <option>ESET Endpoint ANTIVIRUS</option>
                </select>
              </div>
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Champs optionnels</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="matricule">Matricule</Label>
                    <Input id="matricule" placeholder="Matricule" value={form.matricule} onChange={(e) => handleField("matricule", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pseudo">Pseudo</Label>
                    <Input id="pseudo" placeholder="Pseudo" value={form.pseudo} onChange={(e) => handleField("pseudo", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="nom">Nom</Label>
                    <Input id="nom" placeholder="Nom" value={form.nom} onChange={(e) => handleField("nom", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="service">Service</Label>
                    <select id="service" value={form.service} onChange={(e) => handleField("service", e.target.value)} className={SC}>
                      <option value="">— Choisir —</option>
                      <option>Administration et Finance</option><option>Agence</option><option>Comex</option>
                      <option>Communication et Design</option><option>Data Client</option><option>Direction Produit</option>
                      <option>Externe</option><option>Fram</option><option>Groupes</option>
                      <option>Groupes - Plateforme Lille</option><option>Groupes - Plateforme Nord</option>
                      <option>Indiv CE</option><option>Informatique</option><option>Juridique</option>
                      <option>Marketing</option><option>Présidence</option><option>Production</option>
                      <option>Qualité</option><option>Relation Client</option><option>Ressources Humaines</option>
                      <option>Stock</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="uid">UID</Label>
                    <Input id="uid" placeholder="UID" value={form.uid} onChange={(e) => handleField("uid", e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox id="absence" checked={form.absence} onCheckedChange={(c) => handleField("absence", !!c)} />
                    <Label htmlFor="absence" className="cursor-pointer">ABSENCE</Label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="remarques">Remarques</Label>
                  <Textarea id="remarques" placeholder="Remarques éventuelles…" rows={2} value={form.remarques} onChange={(e) => handleField("remarques", e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}><ArrowLeft size={14} />Retour</Button>
              <Button onClick={() => insertMutation.mutate(form)} disabled={!isFormValid() || insertMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                <PlusCircle size={14} />{insertMutation.isPending ? "Ajout en cours…" : "Ajouter l'asset"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AbcroisiereAddAssetModal;
