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
import { Search, UserCheck } from "lucide-react";

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

const StockAffecterModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState("");
  const [stockRow, setStockRow] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<FormData>({
    nom: "", uid: "", matricule: "", pseudo: "",
    service: "", type: "", sn: "", dns: "",
    windows_version: "", remarques: "",
  });
  const queryClient = useQueryClient();

  const lookupMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const { data, error } = await supabase
        .from("stock_inventory")
        .select("*")
        .eq("asset", assetCode.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const affecterMutation = useMutation({
    mutationFn: async () => {
      if (!stockRow) throw new Error("Aucune donnée trouvée");

      // Insérer dans inventory_items avec les infos d'affectation
      const { error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          asset: stockRow.asset as string,
          sn: form.sn.trim() || (stockRow.sn as string) || "",
          type: form.type || (stockRow.type as string) || "portable",
          dns: form.dns.trim() || (stockRow.dns as string) || "",
          windows_version: form.windows_version.trim() || (stockRow.windows_version as string) || "",
          eset_app: stockRow.eset_app as string ?? null,
          remarques: form.remarques.trim() || (stockRow.remarques as string) || null,
          nom: form.nom.trim(),
          uid: form.uid.trim(),
          matricule: form.matricule.trim() || null,
          pseudo: form.pseudo.trim() || null,
          service: form.service.trim(),
          absence: false,
          pret: false,
          pret_utilisateur: "",
        });
      if (insertError) throw insertError;

      // Supprimer du stock
      const { error: deleteError } = await supabase
        .from("stock_inventory")
        .delete()
        .eq("asset", (stockRow.asset as string).trim());
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      toast.success(`Asset ${asset.trim()} affecté à ${form.nom.trim()} et déplacé vers le Siège`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(`Erreur lors de l'affectation : ${err.message}`);
    },
  });

  const handleClose = () => {
    setStep("asset");
    setAsset("");
    setStockRow(null);
    setForm({ nom: "", uid: "", matricule: "", pseudo: "", service: "", type: "", sn: "", dns: "", windows_version: "", remarques: "" });
    lookupMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!asset.trim()) return;
    const result = await lookupMutation.mutateAsync(asset.trim());
    if (!result) {
      toast.error(`Aucun équipement trouvé dans le stock avec l'asset "${asset.trim()}"`);
      return;
    }
    setStockRow(result as Record<string, unknown>);
    setForm({
      nom: "",
      uid: "",
      matricule: "",
      pseudo: "",
      service: "",
      type: (result.type as string) ?? "",
      sn: (result.sn as string) ?? "",
      dns: (result.dns as string) ?? "",
      windows_version: (result.windows_version as string) ?? "",
      remarques: (result.remarques as string) ?? "",
    });
    setStep("form");
  };

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSave = form.nom.trim() !== "" && form.uid.trim() !== "" && form.service.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {step === "asset" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck size={18} className="text-violet-500" />
                Affecter un PC du stock — Étape 1/2
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset. L'équipement sera déplacé vers le Siège une fois affecté.
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
                <span className="text-foreground font-medium">Nom</span>, <span className="text-foreground font-medium">UID</span> et <span className="text-foreground font-medium">Service</span> sont obligatoires. L'asset sera déplacé vers le Siège.
              </DialogDescription>
            </DialogHeader>

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
                <Label>Service <span className="text-destructive">*</span></Label>
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
                onClick={() => affecterMutation.mutate()}
                disabled={!canSave || affecterMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <UserCheck size={14} />
                {affecterMutation.isPending ? "Déplacement…" : "Affecter → Siège"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockAffecterModal;
