import { HeadsetIcon } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import SupportCalendar from '@/components/support/SupportCalendar';

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
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Support IT</h1>
                <p className="text-xs text-muted-foreground">Planning des interventions</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
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
    </div>

    {/* Main content */}
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <SupportCalendar />
    </main>
  </div>
);

export default Support;
