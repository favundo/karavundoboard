import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarPlus, RefreshCw } from 'lucide-react';

import {
  useSupportAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  type SupportAppointment,
  type AppointmentInsert,
} from '@/hooks/useSupportAppointments';
import { TECHNICIANS, getTechnicianById } from '@/lib/technicians';
import { sendAppointmentEmail } from '@/lib/emailApi';
import AppointmentModal from './AppointmentModal';
import CloseModal from './CloseModal';
import EventDetailPopover from './EventDetailPopover';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SupportAppointment;
}

const TYPE_LABELS: Record<string, string> = {
  changement_machine: 'Changement de machine',
  remasterisation:    'Remasterisation',
  demenagement:       'Déménagement',
  installation:       'Installation',
};

const messages = {
  today: "Aujourd'hui",
  previous: '‹',
  next: '›',
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  agenda: 'Agenda',
  date: 'Date',
  time: 'Heure',
  event: 'Événement',
  noEventsInRange: 'Aucune intervention sur cette période.',
};

const SupportCalendar = () => {
  const { data: appointments = [], isLoading, refetch } = useSupportAppointments();
  const createAppt = useCreateAppointment();
  const updateAppt = useUpdateAppointment();
  const deleteAppt = useDeleteAppointment();

  const [createOpen, setCreateOpen]         = useState(false);
  const [editAppt, setEditAppt]             = useState<SupportAppointment | null>(null);
  const [detailAppt, setDetailAppt]         = useState<SupportAppointment | null>(null);
  const [closeAppt, setCloseAppt]           = useState<SupportAppointment | null>(null);
  const [filterTech, setFilterTech]         = useState<string>('all');
  const [emailError, setEmailError]         = useState('');

  const events: CalEvent[] = useMemo(() =>
    appointments
      .filter((a) => filterTech === 'all' || a.uid_technicien === filterTech)
      .map((a) => {
        const start = new Date(a.date_rdv);
        const end = new Date(start.getTime() + a.duree_minutes * 60 * 1000);
        const typeLabel = TYPE_LABELS[a.type_intervention] ?? a.type_intervention;
        const tech = getTechnicianById(a.uid_technicien);
        return {
          id: a.id,
          title: `${typeLabel} — ${a.uid_user} (${tech?.label ?? a.uid_technicien})`,
          start,
          end,
          resource: a,
        };
      }),
    [appointments, filterTech],
  );

  const eventStyleGetter = useCallback((event: CalEvent) => {
    const tech = getTechnicianById(event.resource.uid_technicien);
    const isClosed = event.resource.statut === 'cloture';
    return {
      style: {
        backgroundColor: isClosed ? '#9ca3af' : (tech?.bgColor ?? '#3b82f6'),
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        opacity: isClosed ? 0.6 : 1,
        fontSize: '12px',
      },
    };
  }, []);

  const handleEventClick = useCallback((event: CalEvent) => {
    setDetailAppt(event.resource);
  }, []);

  const handleCreate = async (data: AppointmentInsert) => {
    setEmailError('');
    const created = await createAppt.mutateAsync(data);
    try {
      await sendAppointmentEmail('create', created as SupportAppointment);
    } catch {
      setEmailError('RDV créé, mais l\'envoi de l\'email a échoué. Vérifiez la configuration SMTP.');
    }
  };

  const handleUpdate = async (data: AppointmentInsert) => {
    if (!editAppt) return;
    setEmailError('');
    const updated = await updateAppt.mutateAsync({ id: editAppt.id, ...data });
    try {
      await sendAppointmentEmail('update', updated as SupportAppointment);
    } catch {
      setEmailError('RDV modifié, mais l\'envoi de l\'email a échoué.');
    }
  };

  const handleDelete = async () => {
    if (!editAppt) return;
    setEmailError('');
    await deleteAppt.mutateAsync(editAppt.id);
    try {
      await sendAppointmentEmail('delete', editAppt);
    } catch {
      setEmailError('RDV supprimé, mais l\'envoi de l\'email a échoué.');
    }
  };

  const handleClose = async () => {
    if (!closeAppt) return;
    setEmailError('');
    const updated = await updateAppt.mutateAsync({ id: closeAppt.id, statut: 'cloture' });
    try {
      await sendAppointmentEmail('close', updated as SupportAppointment);
    } catch {
      setEmailError('RDV clôturé, mais l\'envoi de l\'email a échoué.');
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planning Support IT</h1>
          <p className="text-xs text-muted-foreground">Interventions planifiées — cliquez sur un événement pour le gérer</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <CalendarPlus size={15} />
            Prise de rendez-vous
          </button>
        </div>
      </div>

      {/* Legend + filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilterTech('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterTech === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground/40'}`}
        >
          Tous
        </button>
        {TECHNICIANS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterTech(filterTech === t.id ? 'all' : t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterTech === t.id ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:border-foreground/40'}`}
            style={filterTech === t.id ? { backgroundColor: t.bgColor, borderColor: t.bgColor } : {}}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.bgColor }} />
            {t.label}
          </button>
        ))}
      </div>

      {emailError && (
        <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
          {emailError}
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden" style={{ minHeight: 600 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            defaultView={Views.WEEK}
            views={[Views.WEEK, Views.MONTH, Views.AGENDA]}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%', padding: '12px' }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={handleEventClick}
            messages={messages}
            culture="fr"
            min={new Date(0, 0, 0, 8, 0)}
            max={new Date(0, 0, 0, 19, 0)}
            popup
            formats={{
              dayFormat: (date: Date) => format(date, 'EEE dd', { locale: fr }),
              weekdayFormat: (date: Date) => format(date, 'EEE', { locale: fr }),
              monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: fr }),
              agendaDateFormat: (date: Date) => format(date, 'EEE dd MMMM', { locale: fr }),
            }}
          />
        )}
      </div>

      {/* Modals */}
      <AppointmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AppointmentModal
        open={!!editAppt}
        onClose={() => setEditAppt(null)}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        existing={editAppt}
      />

      {detailAppt && (
        <EventDetailPopover
          appointment={detailAppt}
          onClose={() => setDetailAppt(null)}
          onEdit={() => { setEditAppt(detailAppt); setDetailAppt(null); }}
          onCloseAppointment={() => { setCloseAppt(detailAppt); setDetailAppt(null); }}
        />
      )}

      <CloseModal
        open={!!closeAppt}
        appointment={closeAppt}
        onClose={() => setCloseAppt(null)}
        onConfirm={handleClose}
      />
    </div>
  );
};

export default SupportCalendar;
