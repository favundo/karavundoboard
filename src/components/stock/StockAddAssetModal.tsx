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
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, ArrowLeft } from "lucide-react";

type Step = "input" | "form";

interface FormData {
  asset: string;
  sn: string;
  type: string;
  dns: string;
  windows_version: string;
  eset_app: string;
  remarques: string;
}

const EMPTY_FORM: FormData = {
  asset: "",
  sn: "",
  type: "",
  dns: "",
  windows_version: "",
  eset_app: "",
  remarques: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const StockAddAssetModal = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("input");
  const [assetInput, setAssetInput] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const queryClient = useQueryClient();

  const checkMutation = useMutation({
    mutationFn: async (assetCode: string) => {
      const [r1, r2] = await Promise.all([
        supabase.from("stock_inventory").select("asset").eq("asset", assetCode.trim()).maybeSingle(),
        supabase.from("inventory_items").select("asset").eq("asset", assetCode.trim()).maybeSingle(),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      return r1.data ?? r2.data;
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const { error } = await supabase.from("stock_inventory").insert({
        asset: payload.asset.trim(),
        sn: payload.sn.trim(),
        type: payload.type.trim(),
        dns: payload.dns.trim(),
        windows_version: payload.windows_version.trim(),
        eset_app: payload.eset_app.trim() || null,
        remarques: payload.remarques.trim() || null,
        nom: "",
        service: "",
        absence: false,
        pret: false,
        pret_utilisateur: "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      toast.success(`Asset ${form.asset.trim()} ajouté au stock`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(`Erreur lors de l'ajout : ${err.message}`);
    },
  });

  const handleClose = () => {
    setStep("input");
    setAssetInput("");
    setForm(EMPTY_FORM);
    checkMutation.reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!assetInput.trim()) return;
    const existing = await checkMutation.mutateAsync(assetInput.trim());
    if (existing) {
      toast.error(`L'asset "${assetInput.trim()}" existe déjà dans l'inventaire`);
    } else {
      setForm({ ...EMPTY_FORM, asset: assetInput.trim() });
      setStep("form");
    }
  };

  const handleField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = () =>
    form.asset.trim() &&
    form.sn.trim() &&
    form.type.trim() &&
    form.dns.trim() &&
    form.windows_version.trim() &&
    form.eset_app.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {step === "input" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle size={18} className="text-green-600 dark:text-green-400" />
                Ajouter un asset au stock
              </DialogTitle>
              <DialogDescription>
                Saisissez le numéro d'asset de l'équipement à ajouter au stock.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Numéro d'asset (ex: ABC12345)"
                value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSearch} disabled={!assetInput.trim() || checkMutation.isPending}>
                <Search size={14} />
                Continuer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle size={18} className="text-green-600 dark:text-green-400" />
                Informations de l'asset stock
              </DialogTitle>
              <DialogDescription>
                Les champs marqués <span className="text-destructive">*</span> sont obligatoires.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>ASSET <span className="text-destructive">*</span></Label>
                <Input value={form.asset} readOnly className="bg-muted" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>SN <span className="text-destructive">*</span></Label>
                  <Input placeholder="Numéro de série" value={form.sn} onChange={(e) => handleField("sn", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Type <span className="text-destructive">*</span></Label>
                  <select
                    value={form.type}
                    onChange={(e) => handleField("type", e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">— Choisir —</option>
                    <option value="portable">Portable</option>
                    <option value="Pc Fixe">Pc Fixe</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>NOM DNS <span className="text-destructive">*</span></Label>
                  <Input placeholder="ex: PC-STOCK01" value={form.dns} onChange={(e) => handleField("dns", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Version Windows <span className="text-destructive">*</span></Label>
                  <select
                    value={form.windows_version}
                    onChange={(e) => handleField("windows_version", e.target.value)}
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
              </div>

              <div className="space-y-1">
                <Label>App. ESET <span className="text-destructive">*</span></Label>
                <select
                  value={form.eset_app}
                  onChange={(e) => handleField("eset_app", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option>ESET Endpoint Security</option>
                  <option>ESET Endpoint ANTIVIRUS</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Remarques</Label>
                <Textarea
                  placeholder="Remarques éventuelles…"
                  rows={2}
                  value={form.remarques}
                  onChange={(e) => handleField("remarques", e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft size={14} />
                Retour
              </Button>
              <Button
                onClick={() => insertMutation.mutate(form)}
                disabled={!isFormValid() || insertMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <PlusCircle size={14} />
                {insertMutation.isPending ? "Ajout en cours…" : "Ajouter au stock"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockAddAssetModal;
