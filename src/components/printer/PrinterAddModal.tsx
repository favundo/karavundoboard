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
import { PlusCircle } from "lucide-react";
import { PRINTER_MODELS } from "@/hooks/usePrinterInventory";

interface FormData {
  asset: string;
  modele: string;
  service: string;
  date_enregistrement: string;
  warranty_duration: string;
  ip: string;
  sn: string;
  mac: string;
  hostname: string;
  emplacement: string;
  fabricant: string;
}

const EMPTY_FORM: FormData = {
  asset: "",
  modele: "",
  service: "",
  date_enregistrement: "",
  warranty_duration: "",
  ip: "",
  sn: "",
  mac: "",
  hostname: "",
  emplacement: "",
  fabricant: "EPSON",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const PrinterAddModal = ({ open, onClose }: Props) => {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const queryClient = useQueryClient();

  const insertMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const asset = payload.asset.trim();
      // Unicité de l'asset
      const { data: existing, error: checkError } = await supabase
        .from("printer_inventory")
        .select("asset")
        .eq("asset", asset)
        .maybeSingle();
      if (checkError) throw checkError;
      if (existing) throw new Error(`L'asset "${asset}" existe déjà dans l'inventaire imprimantes.`);

      const { error } = await supabase.from("printer_inventory").insert({
        asset,
        modele: payload.modele.trim(),
        service: payload.service.trim(),
        date_enregistrement: payload.date_enregistrement || null,
        warranty_duration: payload.warranty_duration ? parseInt(payload.warranty_duration, 10) : null,
        ip: payload.ip.trim() || null,
        sn: payload.sn.trim() || null,
        mac: payload.mac.trim() || null,
        hostname: payload.hostname.trim() || null,
        emplacement: payload.emplacement.trim() || null,
        fabricant: payload.fabricant.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printer-inventory"] });
      toast.success(`Imprimante ${form.asset.trim()} ajoutée avec succès`);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de l'ajout");
    },
  });

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleField = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid =
    form.asset.trim() &&
    form.modele.trim() &&
    form.service.trim() &&
    form.date_enregistrement &&
    form.warranty_duration.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    insertMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle size={18} className="text-green-600 dark:text-green-400" />
            Ajouter une imprimante
          </DialogTitle>
          <DialogDescription>
            Les champs marqués <span className="text-destructive">*</span> sont obligatoires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="asset">Asset <span className="text-destructive">*</span></Label>
              <Input
                id="asset"
                placeholder="ex: 17718"
                value={form.asset}
                onChange={(e) => handleField("asset", e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modele">Modèle <span className="text-destructive">*</span></Label>
              <select
                id="modele"
                value={form.modele}
                onChange={(e) => handleField("modele", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {PRINTER_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="service">Service <span className="text-destructive">*</span></Label>
              <Input
                id="service"
                placeholder="ex: 20-2eme-paye"
                value={form.service}
                onChange={(e) => handleField("service", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date_enregistrement">Date d'enregistrement <span className="text-destructive">*</span></Label>
              <Input
                id="date_enregistrement"
                type="date"
                value={form.date_enregistrement}
                onChange={(e) => handleField("date_enregistrement", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="warranty_duration">Durée garantie (ans) <span className="text-destructive">*</span></Label>
              <Input
                id="warranty_duration"
                type="number"
                min={0}
                placeholder="ex: 3"
                value={form.warranty_duration}
                onChange={(e) => handleField("warranty_duration", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fabricant">Fabricant</Label>
              <Input
                id="fabricant"
                placeholder="ex: EPSON"
                value={form.fabricant}
                onChange={(e) => handleField("fabricant", e.target.value)}
              />
            </div>
          </div>

          {/* Champs optionnels */}
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Champs optionnels</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ip">Adresse IP</Label>
                <Input
                  id="ip"
                  placeholder="ex: 10.12.3.129"
                  value={form.ip}
                  onChange={(e) => handleField("ip", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sn">Numéro de série</Label>
                <Input
                  id="sn"
                  placeholder="N° de série"
                  value={form.sn}
                  onChange={(e) => handleField("sn", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mac">Adresse MAC</Label>
                <Input
                  id="mac"
                  placeholder="ex: F8:25:51:9B:50:34"
                  value={form.mac}
                  onChange={(e) => handleField("mac", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hostname">Nom d'hôte</Label>
                <Input
                  id="hostname"
                  placeholder="ex: print17718.in.karavel.com"
                  value={form.hostname}
                  onChange={(e) => handleField("hostname", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="emplacement">Emplacement</Label>
              <Input
                id="emplacement"
                placeholder="ex: Paris Siège"
                value={form.emplacement}
                onChange={(e) => handleField("emplacement", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || insertMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <PlusCircle size={14} />
            {insertMutation.isPending ? "Ajout en cours…" : "Ajouter l'imprimante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrinterAddModal;
