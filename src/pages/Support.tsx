import { HeadsetIcon, LayoutDashboard, CalendarDays, ClipboardList, UserPlus, BarChart3, ShieldCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PriorityTicker } from '@/components/support/PriorityTicker';
import { useMe } from '@/hooks/useMe';
import { getTechnicianById } from '@/lib/technicians';

const SUB_NAV = [
  { to: '/support/dashboard',    label: 'Dashboard & Recherche rapide',          icon: LayoutDashboard },
  { to: '/support/planning',     label: 'Planning des interventions support IT',  icon: CalendarDays   },
  { to: '/support/planning-tsi', label: 'Planning TSI',                           icon: ClipboardList  },
  { to: '/support/arrivees',     label: 'Arrivées',                               icon: UserPlus       },
  { to: '/support/stats',        label: 'Stats support',                           icon: BarChart3      },
];

/**
 * Identité du technicien connecté. Absente hors authentification : le bandeau
 * disparaît alors sans rien casser.
 */
const ConnectedAs = () => {
  const { data: me } = useMe();
  if (!me?.authenticated) return null;

  const tech = getTechnicianById(me.uid);

  return (
    <div className="flex items-center gap-2">
      {me.dev && (
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          dev
        </span>
      )}
      {me.isAdmin && (
        <span
          title="Membre du groupe administrateurs"
          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
        >
          <ShieldCheck size={11} />
          admin
        </span>
      )}
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tech?.bgColor ?? 'currentColor' }}
        />
        {tech?.label ?? me.displayName}
      </span>
    </div>
  );
};

const Support = () => (
  <div className="min-h-screen bg-background">

    {/* Header / Nav — même style que les autres pages */}
    <div className="sticky top-0 z-50 bg-card/50 backdrop-blur-sm border-b border-border">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HeadsetIcon size={20} />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Support IT</h1>
            </div>
            <div className="flex items-center gap-4">
              <ConnectedAs />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation tabs principale */}
      <nav className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex gap-1 py-2 overflow-x-auto">
          {[
            { to: '/',            label: 'Siège & Groupes' },
            { to: '/agences',     label: 'Réseau Agences' },
            { to: '/abcroisiere', label: 'ABcroisière' },
            { to: '/support',     label: 'Support' },
            { to: '/gestion',     label: 'Gestion' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bandeau défilant des tickets RT à haute priorité */}
      <PriorityTicker />

      {/* Sous-navigation Support */}
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 border-t border-border/50 bg-muted/20">
        <div className="flex gap-1 py-1.5 overflow-x-auto">
          {SUB_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className="shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="bg-background text-foreground shadow-sm border border-border"
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>

    {/* Main content — rendu par le sous-route actif */}
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Outlet />
    </main>
  </div>
);

export default Support;
