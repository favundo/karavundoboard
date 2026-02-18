import { useState } from "react";
import { Lock, X, Loader2 } from "lucide-react";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Simple password — change here to customize
const IMPORT_PASSWORD = "admin2024";

const PinModal = ({ open, onClose, onSuccess }: PinModalProps) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setValue("");
    setError(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Small artificial delay for UX
    await new Promise((r) => setTimeout(r, 300));
    setLoading(false);
    if (value === IMPORT_PASSWORD) {
      setValue("");
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setValue("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock size={16} />
            </div>
            <p className="text-sm font-semibold text-foreground">Accès protégé</p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <p className="text-xs text-muted-foreground">
            Entrez le mot de passe pour accéder à l'import de données.
          </p>

          <div className="space-y-1.5">
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false); }}
              placeholder="Mot de passe"
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/30 ${
                error ? "border-destructive focus:ring-destructive/30" : "border-border"
              }`}
            />
            {error && (
              <p className="text-xs text-destructive">Mot de passe incorrect. Réessayez.</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="h-9 rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!value || loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinModal;
