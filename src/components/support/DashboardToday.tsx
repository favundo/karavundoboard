import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CalendarRange, Trophy, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRTPriorityTickets } from '@/hooks/useRTPriorityTickets';
import { useSupportAppointments } from '@/hooks/useSupportAppointments';
import { useArrivees } from '@/hooks/useArrivees';
import { useArriveesWorkflow } from '@/hooks/useArriveesWorkflow';
import { useRTScore } from '@/hooks/useRTScore';
import { StatTile } from './stats/StatTile';
import { useMeAsTechnician } from '@/hooks/useMe';

const RT_BASE = 'http://rt.in.karavel.com';
const ARRIVEE_HORIZON_DAYS = 15;
const CLOSED_STATUSES = new Set(['resolved', 'rejected', 'deleted']);

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Semaine calendaire française : lundi → dimanche. */
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// "2026/06/15" ou "2026-06-15" → Date. Même parsing que l'onglet Arrivées :
// la date vient du corps du mail RH, elle n'est pas normalisée.
function parseArriveeDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const jourCourt = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

/** Tuile cliquable : le halo au survol signale l'affordance, la tuile reste identique. */
const Clickable = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="block w-full rounded-xl text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  >
    {children}
  </button>
);

/**
 * Bloc « Aujourd'hui » du dashboard support : ce qui demande une action dans la
 * journée — tickets RT prioritaires, RDV du jour et de la semaine, arrivées
 * imminentes. Chaque tuile mène à l'écran qui permet de traiter le sujet.
 */
export default function DashboardToday() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading: loadingRT } = useRTPriorityTickets();
  const { data: rdvs = [], isLoading: loadingRdv } = useSupportAppointments();
  const { data: arrivees = [], isLoading: loadingArr } = useArrivees();
  const { data: workflow = {} } = useArriveesWorkflow();
  const { data: score, isLoading: loadingScore } = useRTScore();

  // Un technicien connecté voit ses rendez-vous par défaut ; à défaut
  // d'identité, on retombe sur la vue équipe et le sélecteur disparaît.
  const meTech = useMeAsTechnician();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const filtreMoi = Boolean(meTech) && scope === 'mine';

  // Score personnel. Sans identité — dev sans DEV_USER, compte hors
  // technicians.ts — la tuile le dit plutôt que d'afficher le score de personne.
  const monScore = meTech ? score?.owners.find((o) => o.owner === meTech.id) : undefined;

  const agenda = useMemo(() => {
    const now = new Date();
    const debutJour = startOfDay(now);
    const finJour = addDays(debutJour, 1);
    const debutSemaine = startOfWeek(now);
    const finSemaine = addDays(debutSemaine, 7);

    const planifies = rdvs
      .filter(r => r.statut === 'planifie')
      .filter(r => !filtreMoi || r.uid_technicien === meTech!.id)
      .map(r => ({ ...r, date: new Date(r.date_rdv) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const duJour = planifies.filter(r => r.date >= debutJour && r.date < finJour);
    const semaine = planifies.filter(r => r.date >= debutSemaine && r.date < finSemaine);
    const prochain = duJour.find(r => r.date >= now) ?? null;

    return { duJour, semaine, prochain, restants: duJour.filter(r => r.date >= now).length };
  }, [rdvs, filtreMoi, meTech]);

  const arriveesProches = useMemo(() => {
    const aujourdhui = startOfDay(new Date());
    const limite = addDays(aujourdhui, ARRIVEE_HORIZON_DAYS);
    return arrivees
      .filter(a => !workflow[a.id]?.cloture && !CLOSED_STATUSES.has(a.status?.toLowerCase()))
      .map(a => ({ ...a, date: parseArriveeDate(a.dateArrivee) }))
      .filter(a => a.date !== null && a.date >= aujourdhui && a.date <= limite)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());
  }, [arrivees, workflow]);

  const prioMax = tickets.reduce((max, t) => Math.max(max, t.priority), 0);
  const prochaineArrivee = arriveesProches[0];

  const val = (loading: boolean, n: number) => (loading ? '—' : String(n));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Aujourd'hui</h2>

        {meTech && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-xs">
            {([['mine', 'Mes RDV'], ['all', "Toute l'équipe"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setScope(v)}
                aria-pressed={scope === v}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  scope === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <a
          href={`${RT_BASE}/Search/Results.html?Query=${encodeURIComponent("Status = 'new' OR Status = 'open'")}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <StatTile
            icon={AlertTriangle}
            label="Tickets prioritaires"
            value={val(loadingRT, tickets.length)}
            hint={
              loadingRT ? 'chargement…'
                : tickets.length ? `priorité max ${prioMax} — ouvrir RT`
                : 'aucun ticket au-dessus du seuil'
            }
            tone={tickets.length ? 'warning' : 'good'}
          />
        </a>

        <Clickable onClick={() => navigate('/support/planning')}>
          <StatTile
            icon={CalendarClock}
            label="RDV aujourd'hui"
            value={val(loadingRdv, agenda.duJour.length)}
            hint={
              loadingRdv ? 'chargement…'
                : agenda.prochain ? `prochain à ${heure(agenda.prochain.date_rdv)} — ${agenda.prochain.uid_technicien}`
                : agenda.duJour.length ? 'tous passés'
                : 'aucune intervention planifiée'
            }
          />
        </Clickable>

        <Clickable onClick={() => navigate('/support/planning')}>
          <StatTile
            icon={CalendarRange}
            label="RDV cette semaine"
            value={val(loadingRdv, agenda.semaine.length)}
            hint={
              loadingRdv ? 'chargement…'
                : filtreMoi ? 'vos interventions, lundi à dimanche'
                : "toute l'équipe, lundi à dimanche"
            }
          />
        </Clickable>

        <Clickable onClick={() => navigate('/support/stats')}>
          <StatTile
            icon={Trophy}
            label="Mon score"
            value={!meTech ? '—' : val(loadingScore, monScore?.score ?? 0)}
            hint={
              !meTech ? 'technicien non identifié'
                : loadingScore ? 'chargement…'
                : monScore?.today
                  ? `+${monScore.today} aujourd'hui — ${monScore.todayTickets} ticket${monScore.todayTickets > 1 ? 's' : ''}`
                  : `aucun point aujourd'hui — ${score?.year ?? ''} en cumul`
            }
            tone={monScore?.today ? 'good' : 'neutral'}
          />
        </Clickable>

        <Clickable onClick={() => navigate('/support/arrivees')}>
          <StatTile
            icon={UserPlus}
            label={`Arrivées sous ${ARRIVEE_HORIZON_DAYS} j`}
            value={val(loadingArr, arriveesProches.length)}
            hint={
              loadingArr ? 'chargement…'
                : prochaineArrivee
                  ? `prochaine le ${jourCourt(prochaineArrivee.date!)} — ${[prochaineArrivee.prenom, prochaineArrivee.nom].filter(Boolean).join(' ') || 'nom inconnu'}`
                  : 'aucune arrivée à préparer'
            }
            tone={arriveesProches.length ? 'warning' : 'neutral'}
          />
        </Clickable>
      </div>
    </section>
  );
}
