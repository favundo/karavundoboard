import { useState, useCallback, useRef } from "react";
import { Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet, ChevronRight, Loader2 } from "lucide-react";
import { parseFile, type ParseResult } from "@/lib/parseInventory";
import { useReplaceAbcroisiereInventory } from "@/hooks/useAbcroisiereInventory";
import { type InventoryItem } from "@/data/inventoryData";

interface AbcroisiereImportModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "upload" | "preview" | "success";

const AbcroisiereImportModal = ({ open, onClose }: AbcroisiereImportModalProps) => {
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInventory = useReplaceAbcroisiereInventory();

  const reset = () => {
    setStep("upload");
    setParseResult(null);
    setParsing(false);
    setFileName("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      alert("Format non supporté. Utilisez un fichier .xlsx, .xls ou .csv");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    const result = await parseFile(file);
    setParseResult(result);
    setParsing(false);
    if (result.errors.length === 0) {
      setStep("preview");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConfirm = async () => {
    if (!parseResult) return;
    await replaceInventory.mutateAsync(parseResult.items);
    setStep("success");
  };

  if (!open) return null;

  const PREVIEW_COLS: { key: keyof InventoryItem; label: string }[] = [
    { key: "nom", label: "Collaborateur" },
    { key: "service", label: "Service" },
    { key: "type", label: "Type" },
    { key: "asset", label: "Asset" },
    { key: "sn", label: "N° Série" },
    { key: "dns", label: "DNS" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Mettre à jour l'inventaire ABcroisière</h2>
              <p className="text-xs text-muted-foreground">Importez votre fichier Excel ou CSV</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-6 py-3">
          {(["upload", "preview", "success"] as Step[]).map((s, i) => {
            const labels = ["1. Fichier", "2. Aperçu", "3. Terminé"];
            const active = s === step;
            const done =
              (s === "upload" && (step === "preview" || step === "success")) ||
              (s === "preview" && step === "success");
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {labels[i]}
                </span>
                {i < 2 && <ChevronRight size={12} className="text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="p-6">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-all ${
                  dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {parsing ? (
                  <Loader2 size={40} className="animate-spin text-primary" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Upload size={28} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {parsing ? "Analyse en cours…" : "Glissez votre fichier ici"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ou <span className="text-primary underline">parcourez</span> vos fichiers
                  </p>
                </div>
                <div className="flex gap-2">
                  {[".xlsx", ".xls", ".csv"].map((ext) => (
                    <span key={ext} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono font-medium text-secondary-foreground">{ext}</span>
                  ))}
                </div>
              </div>

              {parseResult?.errors.length ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                    <div className="space-y-1">
                      {parseResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Colonnes attendues dans votre fichier
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Nom", "Service", "Asset", "Type", "SN", "DNS", "UID", "Matricule", "Absence", "Remarques"].map((col) => (
                    <span key={col} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      ["Nom", "Service"].includes(col) ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"
                    }`}>
                      {col}{["Nom", "Service"].includes(col) && " *"}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">* Colonnes obligatoires</p>
              </div>
            </div>
          )}

          {step === "preview" && parseResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-primary">{parseResult.items.length} équipements</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  depuis <span className="font-medium text-foreground">{fileName}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/30 px-4 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Aperçu — {Math.min(parseResult.items.length, 8)} premières lignes sur {parseResult.items.length}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {PREVIEW_COLS.map((c) => (
                          <th key={c.key} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.items.slice(0, 8).map((item, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground">{item.nom || "—"}</td>
                          <td className="px-3 py-2"><span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">{item.service || "—"}</span></td>
                          <td className="px-3 py-2 text-muted-foreground">{item.type === "portable" ? "Portable" : "PC Fixe"}</td>
                          <td className="px-3 py-2 font-mono text-primary">{item.asset || "—"}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{item.sn || "—"}</td>
                          <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">{item.dns || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-xs text-primary">
                  ✅ Ces {parseResult.items.length} équipements seront <strong>ajoutés</strong> à l'inventaire existant, sans supprimer les données actuelles.
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">Import réussi !</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {parseResult?.items.length} équipements importés — le dashboard est mis à jour.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          {step === "upload" && (
            <button onClick={handleClose} className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground">Annuler</button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => { setStep("upload"); setParseResult(null); }} className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground">← Retour</button>
              <button
                onClick={handleConfirm}
                disabled={replaceInventory.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {replaceInventory.isPending ? (<><Loader2 size={14} className="animate-spin" /> Import en cours…</>) : <>Confirmer l'import</>}
              </button>
            </>
          )}
          {step === "success" && (
            <button onClick={handleClose} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbcroisiereImportModal;
