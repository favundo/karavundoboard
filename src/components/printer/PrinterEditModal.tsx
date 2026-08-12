import { useEffect, useState } from "react";
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
import { Pencil } from "lucide-react";
import { PRINTER_MODELS, type PrinterItem } from "@/hooks/usePrinterInventory";

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

const toForm = (p: PrinterItem): FormData => ({
  asset: p.asset,
  modele: p.modele,
  service: p.service,
  date_enregistrement: p.date_enregistrement ?? "",
  warranty_duration: p.warranty_duration != null ? String(p.warranty_duration) : "",
  ip: p.ip,
  sn: p.sn,
  mac: p.mac,
  hostname: p.hostname,
  emplacement: p.emplacement,
  fabricant: p.fabricant,
});

interface Props {
  printer: PrinterItem | null;
  onClose: () => void;
}

const PrinterEditModal = ({ printer, onClose }: Props) => {
  const [form, setForm] = useState<FormData | null>(null);
  const queryClient = useQueryClient();

  // Recharge le formulaire à chaque changement d'imprimante sélectionnée
  useEffect(() => {
    setForm(printer ? toForm(printer) : null);
  }, [printer]);

  const updateMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      if (!printer) return;
      const asset = payload.asset.trim();

      // Unicité de l'asset — uniquement s'il a changé
      if (asset !== printer.asset) {
        const { data: existing, error: checkError } = await supabase
          .from("printer_inventory")
          .select("asset")
          .eq("asset", asset)
          .maybeSingle();
        if (checkError) throw checkError;
        if (existing) throw new Error(`L'asset "${asset}" existe déjà dans l'inventaire imprimantes.`);
      }

      const { error } = await supabase
        .from("printer_inventory")
        .update({
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
        })
        .eq("id", printer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printer-inventory"] });
      toast.success(`Imprimante ${form?.asset.trim()} modifiée avec succès`);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de la modification");
    },
  });

  const handleField = (field: keyof FormData, value: string) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const isValid =
    !!form &&
    !!form.asset.trim() &&
    !!form.modele.trim() &&
    !!form.service.trim() &&
    !!form.date_enregistrement &&
    !!form.warranty_duration.trim();

  const handleSubmit = () => {
    if (!isValid || !form) return;
    updateMutation.mutate(form);
  };

  // Un modèle hors liste (venu d'un import) doit rester sélectionnable
  const modelOptions = form && form.modele && !PRINTER_MODELS.includes(form.modele as typeof PRINTER_MODELS[number])
    ? [form.modele, ...PRINTER_MODELS]
    : [...PRINTER_MODELS];

  return (
    <Dialog open={!!printer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={18} className="text-primary" />
            Modifier l'imprimante
          </DialogTitle>
          <DialogDescription>
            Les champs marqués <span className="text-destructive">*</span> sont obligatoires.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-asset">Asset <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-asset"
                  value={form.asset}
                  onChange={(e) => handleField("asset", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-modele">Modèle <span className="text-destructive">*</span></Label>
                <select
                  id="edit-modele"
                  value={form.modele}
                  onChange={(e) => handleField("modele", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-service">Service <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-service"
                  value={form.service}
                  onChange={(e) => handleField("service", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-date">Date d'enregistrement <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={form.date_enregistrement}
                  onChange={(e) => handleField("date_enregistrement", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-warranty">Durée garantie (ans) <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-warranty"
                  type="number"
                  min={0}
                  value={form.warranty_duration}
                  onChange={(e) => handleField("warranty_duration", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-fabricant">Fabricant</Label>
                <Input
                  id="edit-fabricant"
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
                  <Label htmlFor="edit-ip">Adresse IP</Label>
                  <Input
                    id="edit-ip"
                    value={form.ip}
                    onChange={(e) => handleField("ip", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-sn">Numéro de série</Label>
                  <Input
                    id="edit-sn"
                    value={form.sn}
                    onChange={(e) => handleField("sn", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-mac">Adresse MAC</Label>
                  <Input
                    id="edit-mac"
                    value={form.mac}
                    onChange={(e) => handleField("mac", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-hostname">Nom d'hôte</Label>
                  <Input
                    id="edit-hostname"
                    value={form.hostname}
                    onChange={(e) => handleField("hostname", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-emplacement">Emplacement</Label>
                <Input
                  id="edit-emplacement"
                  value={form.emplacement}
                  onChange={(e) => handleField("emplacement", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!isValid || updateMutation.isPending}>
            <Pencil size={14} />
            {updateMutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrinterEditModal;
