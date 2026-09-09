import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InterventionTime } from '@/components/support/stats/InterventionTime';
import { VIZ } from '@/lib/vizColors';
import type { SupportAppointment } from '@/hooks/useSupportAppointments';

// Recharts mesure son conteneur : en jsdom la largeur est 0 et rien ne se dessine.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 200 }}>{children}</div>
    ),
  };
});

const appointments: SupportAppointment[] = [];
vi.mock('@/hooks/useSupportAppointments', () => ({
  useAppointmentsSince: () => ({ data: appointments, isLoading: false, error: null }),
}));

const rdv = (
  uid: string,
  date: string,
  duree: number,
  statut: SupportAppointment['statut'] = 'cloture',
): SupportAppointment => ({
  id: `${uid}-${date}`,
  uid_user: 'user', email_user: 'user@karavel.com',
  uid_technicien: uid,
  service: 'Compta', asset: 'UC00001',
  type_intervention: 'installation',
  date_rdv: date, duree_minutes: duree, statut, ticket_rt: '376886',
  notes: null, rappel_envoye: false,
  created_at: date, updated_at: date,
});

describe('InterventionTime', () => {
  beforeEach(() => {
    // Jeudi 10 septembre 2026, en pleine semaine ISO 37 (7 → 13 septembre).
    vi.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
    appointments.length = 0;
    appointments.push(
      rdv('maabid', '2026-09-07T09:00:00.000Z', 90),
      rdv('maabid', '2026-09-08T09:00:00.000Z', 60, 'planifie'),   // passée, jamais clôturée
      rdv('nehad', '2026-09-09T14:00:00.000Z', 30),
      rdv('nehad', '2026-08-31T09:00:00.000Z', 120),               // semaine précédente
    );
  });

  afterEach(() => vi.useRealTimers());

  it('additionne le temps de la semaine en cours par technicien', () => {
    render(<InterventionTime palette={VIZ.light} />);

    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
    expect(screen.getByText('2 h 30')).toBeInTheDocument();          // total maabid
    expect(screen.getByText('1 h 30')).toBeInTheDocument();          // dont clôturé
    expect(screen.getByText('1 à clôturer')).toBeInTheDocument();    // le rdv passé resté planifié
    expect(screen.getByText('1 / 2')).toBeInTheDocument();           // interventions clôturées / total
  });

  it('remonte la semaine précédente sans toucher aux autres', () => {
    render(<InterventionTime palette={VIZ.light} />);
    fireEvent.click(screen.getByLabelText('Période précédente'));

    expect(screen.getByText('Semaine 36')).toBeInTheDocument();
    expect(screen.getByText('Nehad')).toBeInTheDocument();
    expect(screen.queryByText('M. Abid')).not.toBeInTheDocument();
  });

  it('bascule en mensuel et regroupe tout le mois', () => {
    render(<InterventionTime palette={VIZ.light} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mois' }));

    expect(screen.getByText('Septembre 2026')).toBeInTheDocument();
    // Le rdv du 31 août sort du périmètre : 90 + 60 + 30 = 3 h
    expect(screen.getByText(/3 h/)).toBeInTheDocument();
  });
});
