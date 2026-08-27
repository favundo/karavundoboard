import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SupportStats from '@/components/support/SupportStats';
import fixture from './fixtures/rt-stats-2026.json';

// Recharts mesure son conteneur : en jsdom la largeur est 0 et rien ne se dessine.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 260 }}>{children}</div>
    ),
  };
});

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SupportStats />
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('SupportStats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...fixture, cachedAt: fixture.generatedAt, stale: false }),
    })));
  });

  it('affiche les chiffres clés, le podium et le détail', async () => {
    renderPage();

    // Chiffres clés
    expect(await screen.findByText('2528')).toBeInTheDocument();   // résolus
    expect(screen.getByText('2974')).toBeInTheDocument();          // créés
    expect(screen.getByText('99 %')).toBeInTheDocument();          // absorption 2528 / (2974 - 411 rejetés)

    // Podium : le premier du classement et son volume
    const podium = await screen.findByText('🥇');
    expect(podium).toBeInTheDocument();
    expect(screen.getAllByText('M. Abid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('524').length).toBeGreaterThan(0);

    // « Nobody » est exclu du classement mais présent dans le tableau détaillé
    expect(screen.getByText('Non assigné')).toBeInTheDocument();
  });

  it('affiche le score de difficulté, et un tiret pour les non notés', async () => {
    renderPage();

    // maabid : 40 tickets notés (99 pts) + 3 urgents (4 pts) → 103, moyenne 2,5
    expect(await screen.findByText('103')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();

    // Un ticket sans note n'est pas un ticket facile : score à «\u00a0—\u00a0», jamais à 0
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/76 tickets notés sur 2528 résolus/)).toBeInTheDocument();
    expect(screen.getByText(/4 tickets urgents sur la période/)).toBeInTheDocument();
  });

  it('interroge le bon endpoint', async () => {
    renderPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toBe(`/api/rt/stats?year=${new Date().getFullYear()}&queue=sos`);
  });

  it('affiche un message clair si RT ne répond pas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    renderPage();
    expect(await screen.findByText(/RT n'a pas répondu/)).toBeInTheDocument();
  });
});
