import { useState, useCallback } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Network } from "lucide-react";
import { parseAgencyFile } from "@/lib/parseAgencyInventory";
import { useAppendAgencyInventory, type AgencyItem } from "@/hooks/useAgencyInventory";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void };

const AgencyImportModal = ({ open, onClose }: Props) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AgencyItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const replace = useAppendAgencyInventory();

  const handleFile = useCallback(async (f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 20 Mo)");
      return;
    }
    setFile(f);
    setParsing(true);
    const result = await parseAgencyFile(f);
    setParsing(false);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setPreview(result.items);
    if (result.errors.length === 0 && result.items.length > 0) setStep("preview");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    await replace.mutateAsync(preview);
    setStep("done");
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setWarnings([]);
    setStep("upload");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Network size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Importer l'inventaire réseau agences</h2>
          </div>
          <button onClick={handleClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Upload */}
          {step === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
              >
                {parsing ? (
                  <Loader2 size={36} className="animate-spin text-primary" />
                ) : (
                  <Upload size={36} className="text-muted-foreground" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {parsing ? "Analyse en cours…" : "Glissez votre fichier Excel ici"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Colonnes attendues : Agence, Asset, SN, Type, Version OS, App. ESET
                  </p>
                </div>
                {!parsing && (
                  <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                    Parcourir
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </label>
                )}
              </div>
              {errors.length > 0 && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  {errors.map((e, i) => (
                    <p key={i} className="flex items-center gap-2 text-xs text-destructive"><AlertCircle size={12} />{e}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-primary">{preview.length}</span> équipements prêts à importer
                  {file && <span className="ml-2 text-xs text-muted-foreground">— {file.name}</span>}
                </p>
                <button onClick={() => setStep("upload")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Rechoisir
                </button>
              </div>
              {warnings.length > 0 && (
                <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
              {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{w}</p>
                  ))}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Agence</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Asset</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">SN</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">OS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((item, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-1.5 font-medium text-foreground">{item.agence}</td>
                        <td className="px-3 py-1.5 font-mono text-primary">{item.asset}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{item.sn || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{item.type || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{item.os_version || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <p className="px-3 py-2 text-center text-xs text-muted-foreground border-t border-border">
                    … et {preview.length - 50} autres lignes
                  </p>
                )}
              </div>
              <p className="mt-3 text-xs text-primary">
                ✅ Ces équipements seront <strong>ajoutés</strong> à l'inventaire existant, sans supprimer les données actuelles.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={handleClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
                <button
                  onClick={handleImport}
                  disabled={replace.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {replace.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {replace.isPending ? "Import en cours…" : "Confirmer l'import"}
                </button>
              </div>
            </>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Import réussi !</p>
                <p className="mt-1 text-xs text-muted-foreground">{preview.length} équipements importés avec succès.</p>
              </div>
              <button onClick={handleClose} className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyImportModal;
