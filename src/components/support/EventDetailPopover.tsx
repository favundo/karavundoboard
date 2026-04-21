import { X, Pencil, CheckCircle2 } from 'lucide-react';
import type { SupportAppointment } from '@/hooks/useSupportAppointments';
import { getTechnicianById } from '@/lib/technicians';

const TYPE_LABELS: Record<string, string> = {
  changement_machine: 'Changement de machine',
  remasterisation:    'Remasterisation',
  demenagement:       'Déménagement',
  installation:       'Installation',
};

interface Props {
  appointment: SupportAppointment;
  onClose: () => void;
  onEdit: () => void;
  onCloseAppointment: () => void;
}

const EventDetailPopover = ({ appointment, onClose, onEdit, onCloseAppointment }: Props) => {
  const tech = getTechnicianById(appointment.uid_technicien);
  const start = new Date(appointment.date_rdv);
  const end = new Date(start.getTime() + appointment.duree_minutes * 60 * 1000);
  const isClosed = appointment.statut === 'cloture';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored top bar */}
        <div
          className="h-1.5 rounded-t-xl"
          style={{ backgroundColor: isClosed ? '#9ca3af' : (tech?.bgColor ?? '#3b82f6') }}
        />

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {TYPE_LABELS[appointment.type_intervention] ?? appointment.type_intervention}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                {' · '}
                {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <Row label="Utilisateur" value={appointment.uid_user} />
            <Row label="Email" value={appointment.email_user} />
            <Row label="Technicien">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tech?.bgColor }} />
                {tech?.label ?? appointment.uid_technicien}
              </span>
            </Row>
            <Row label="Machine" value={appointment.asset} />
            <Row label="Service" value={appointment.service} />
            <Row label="Durée" value={`${appointment.duree_minutes >= 60 ? Math.floor(appointment.duree_minutes / 60) + 'h' : ''}${appointment.duree_minutes % 60 > 0 ? appointment.duree_minutes % 60 + 'min' : ''}`} />
            {appointment.notes && <Row label="Notes" value={appointment.notes} />}
            <Row label="Statut">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                {isClosed ? 'Clôturé' : 'Planifié'}
              </span>
            </Row>
          </div>

          {!isClosed && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={onEdit}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil size={12} />
                Modifier
              </button>
              <button
                onClick={onCloseAppointment}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-green-600 text-xs font-medium text-white hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 size={12} />
                Clôturer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-2">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="font-medium text-right">{children ?? value}</span>
  </div>
);

export default EventDetailPopover;
