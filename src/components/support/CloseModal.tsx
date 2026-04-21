import { Loader2, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';
import type { SupportAppointment } from '@/hooks/useSupportAppointments';
import { getTechnicianById } from '@/lib/technicians';

const TYPE_LABELS: Record<string, string> = {
  changement_machine: 'Changement de machine',
  remasterisation:    'Remasterisation',
  demenagement:       'Déménagement',
  installation:       'Installation',
};

interface Props {
  open: boolean;
  appointment: SupportAppointment | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CloseModal = ({ open, appointment, onClose, onConfirm }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !appointment) return null;

  const tech = getTechnicianById(appointment.uid_technicien);
  const start = new Date(appointment.date_rdv);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">

        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-sm font-semibold text-foreground">Clôturer l'intervention</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilisateur</span>
              <span className="font-medium">{appointment.uid_user}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{TYPE_LABELS[appointment.type_intervention] ?? appointment.type_intervention}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Technicien</span>
              <span className="font-medium">{tech?.label ?? appointment.uid_technicien}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Un email de clôture sera envoyé à <strong>{appointment.email_user}</strong>.
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Clôturer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CloseModal;
