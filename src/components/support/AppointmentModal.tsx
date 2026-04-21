import { useState, useEffect } from 'react';
import { X, Loader2, CalendarPlus } from 'lucide-react';
import { TECHNICIANS } from '@/lib/technicians';
import { isBusinessDay } from '@/lib/frenchHolidays';
import { useServices } from '@/hooks/useSupportAppointments';
import type { SupportAppointment, AppointmentInsert } from '@/hooks/useSupportAppointments';

const TYPES = [
  { value: 'changement_machine', label: 'Changement de machine' },
  { value: 'remasterisation',    label: 'Remasterisation' },
  { value: 'demenagement',       label: 'Déménagement' },
  { value: 'installation',       label: 'Installation' },
];

const DURATIONS = Array.from({ length: 16 }, (_, i) => {
  const mins = (i + 1) * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { value: mins, label: h > 0 ? `${h}h${m > 0 ? m : ''}` : `${m}min` };
});

const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMins = 8 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentInsert) => Promise<void>;
  existing?: SupportAppointment | null;
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

const AppointmentModal = ({ open, onClose, onSubmit, existing }: Props) => {
  const { data: services = [] } = useServices();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [uidUser, setUidUser]         = useState('');
  const [emailUser, setEmailUser]     = useState('');
  const [technicien, setTechnicien]   = useState(TECHNICIANS[0].id);
  const [service, setService]         = useState('');
  const [asset, setAsset]             = useState('');
  const [type, setType]               = useState(TYPES[0].value);
  const [date, setDate]               = useState('');
  const [heure, setHeure]             = useState('09:00');
  const [duree, setDuree]             = useState(60);
  const [notes, setNotes]             = useState('');

  const isEdit = !!existing;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const dt = new Date(existing.date_rdv);
      setUidUser(existing.uid_user);
      setEmailUser(existing.email_user);
      setTechnicien(existing.uid_technicien);
      setService(existing.service);
      setAsset(existing.asset);
      setType(existing.type_intervention);
      setDate(dt.toISOString().slice(0, 10));
      setHeure(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
      setDuree(existing.duree_minutes);
      setNotes(existing.notes ?? '');
    } else {
      setUidUser(''); setEmailUser(''); setTechnicien(TECHNICIANS[0].id);
      setService(services[0] ?? ''); setAsset(''); setType(TYPES[0].value);
      setDate(''); setHeure('09:00'); setDuree(60); setNotes('');
    }
    setError('');
  }, [open, existing]);

  // Auto-fill email from uid
  const handleUidChange = (v: string) => {
    setUidUser(v);
    setEmailUser(v ? `${v}@karavel.com` : '');
  };

  const validateDate = (d: string) => {
    if (!d) return false;
    return isBusinessDay(new Date(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDate(date)) {
      setError('La date sélectionnée est un week-end ou un jour férié.');
      return;
    }
    const [h, m] = heure.split(':').map(Number);
    const dateRdv = new Date(date);
    dateRdv.setHours(h, m, 0, 0);

    setLoading(true);
    setError('');
    try {
      await onSubmit({
        uid_user: uidUser.trim(),
        email_user: emailUser.trim(),
        uid_technicien: technicien,
        service,
        asset: asset.trim(),
        type_intervention: type,
        date_rdv: dateRdv.toISOString(),
        duree_minutes: duree,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarPlus size={16} />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {isEdit ? 'Modifier le rendez-vous' : 'Prise de rendez-vous'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* UID User */}
            <div>
              <label className={labelCls}>UID utilisateur *</label>
              <input
                required
                value={uidUser}
                onChange={(e) => handleUidChange(e.target.value)}
                placeholder="ex: jdupont"
                className={inputCls}
              />
            </div>

            {/* Email user */}
            <div>
              <label className={labelCls}>Email utilisateur *</label>
              <input
                required
                type="email"
                value={emailUser}
                onChange={(e) => setEmailUser(e.target.value)}
                placeholder="jdupont@karavel.com"
                className={inputCls}
              />
            </div>

            {/* Technicien */}
            <div>
              <label className={labelCls}>Technicien *</label>
              <select
                required
                value={technicien}
                onChange={(e) => setTechnicien(e.target.value)}
                className={inputCls}
              >
                {TECHNICIANS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Service */}
            <div>
              <label className={labelCls}>Service *</label>
              <select
                required
                value={service}
                onChange={(e) => setService(e.target.value)}
                className={inputCls}
              >
                <option value="">— Sélectionner —</option>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Type intervention */}
            <div>
              <label className={labelCls}>Type d'intervention *</label>
              <select
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputCls}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Asset */}
            <div>
              <label className={labelCls}>Machine (asset) *</label>
              <input
                required
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="ex: PC-12345"
                className={inputCls}
              />
            </div>

            {/* Date */}
            <div>
              <label className={labelCls}>Date *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setError(''); }}
                className={inputCls}
              />
            </div>

            {/* Heure */}
            <div>
              <label className={labelCls}>Heure *</label>
              <select
                required
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className={inputCls}
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Durée */}
            <div>
              <label className={labelCls}>Durée approximative *</label>
              <select
                required
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                className={inputCls}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Informations complémentaires..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer le rendez-vous'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentModal;
