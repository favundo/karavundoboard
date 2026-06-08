import { useState } from 'react';
import {
  UserPlus, ExternalLink, CalendarClock, RefreshCw, Check, X,
  Send, CheckCircle2, Loader2, KeyRound, Network, AppWindow, Phone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useArrivees, type Arrivee } from '@/hooks/useArrivees';
import {
  useArriveesWorkflow, useUpdateArriveeWorkflow, type ArriveeWorkflow,
} from '@/hooks/useArriveesWorkflow';
import { sendMdp, closeArrivee } from '@/lib/arriveesApi';
import { TECHNICIANS } from '@/lib/technicians';

const RT_BASE = 'http://rt.in.karavel.com';
const CLOSED_STATUSES = new Set(['resolved', 'rejected', 'deleted']);

// "2026/06/15" ou "2026-06-15" → Date
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function Countdown({ date }: { date: Date | null }) {
  const n = daysUntil(date);
  if (n === null) return null;
  if (n < 0)   return <span className="text-xs text-muted-foreground">passée</span>;
  if (n === 0) return <span className="text-xs font-semibold text-red-600">aujourd'hui</span>;
  if (n === 1) return <span className="text-xs font-semibold text-amber-600">demain</span>;
  const cls = n <= 7 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`text-xs font-medium ${cls}`}>dans {n} j</span>;
}

const Empty = () => <span className="text-muted-foreground/40">—</span>;

// Bascule compacte fait / à faire avec icône + libellé court
function TaskToggle({
  icon: Icon, label, value, onChange, disabled,
}: {
  icon: LucideIcon; label: string;
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      title={`${label} — ${value ? 'fait' : 'à faire'}`}
      className={`inline-flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        value
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      <Icon size={12} className="shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {value ? <Check size={12} className="shrink-0" /> : <X size={12} className="shrink-0 opacity-50" />}
    </button>
  );
}

const EMPTY_WF: Omit<ArriveeWorkflow, 'ticket_rt'> = {
  compte_ldap: false, logiciels_metiers: false, telephone: false,
  technicien: null, mdp_envoye_at: null, cloture: false, cloture_at: null,
  updated_at: '',
};

function ArriveeRow({
  a, wf, zebra, onPatch,
}: {
  a: Arrivee;
  wf: Omit<ArriveeWorkflow, 'ticket_rt'>;
  zebra: boolean;
  onPatch: (patch: Partial<Omit<ArriveeWorkflow, 'ticket_rt'>>) => void;
}) {
  const qc = useQueryClient();
  const [mdp, setMdp] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const d = parseDate(a.dateArrivee);
  const fullName = [a.prenom, a.nom].filter(Boolean).join(' ');
  const isClosed = wf.cloture || CLOSED_STATUSES.has(a.status?.toLowerCase());

  const handleSendMdp = async () => {
    if (!a.responsableEmail) { toast.error('Email du responsable introuvable dans le ticket'); return; }
    if (!mdp.trim()) { toast.error('Saisissez un mot de passe'); return; }
    setSending(true);
    try {
      await sendMdp({ email: a.responsableEmail, prenom: a.prenom, nom: a.nom, login: a.login, mdp });
      onPatch({ mdp_envoye_at: new Date().toISOString() });
      setMdp(''); // le mdp n'est jamais conservé
      toast.success(`Mot de passe envoyé à ${a.responsableEmail}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await closeArrivee(a.id);
      onPatch({ cloture: true, cloture_at: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ['rt-arrivees'] });
      toast.success(`Ticket #${a.id} clôturé`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec de la clôture');
    } finally {
      setClosing(false);
    }
  };

  const td = 'px-2.5 py-2 border-b border-border/40 align-top';

  return (
    <tr className={`transition-colors hover:bg-muted/20 ${zebra ? 'bg-muted/10' : ''} ${isClosed ? 'opacity-60' : ''}`}>
      {/* Ticket */}
      <td className={`${td} whitespace-nowrap`}>
        <a
          href={`${RT_BASE}/Ticket/Display.html?id=${a.id}`}
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline underline-offset-2"
        >
          #{a.id}<ExternalLink size={11} />
        </a>
      </td>
      {/* Arrivée */}
      <td className={`${td} whitespace-nowrap`}>
        <div className="flex items-center gap-1.5">
          <CalendarClock size={13} className="text-muted-foreground shrink-0" />
          {formatDate(d)}
        </div>
        <Countdown date={d} />
      </td>
      {/* Collaborateur (+ login) */}
      <td className={`${td} whitespace-nowrap`}>
        <div className="font-medium">{fullName || <Empty />}</div>
        {a.login && (
          <div className="font-mono text-[11px] text-muted-foreground">{a.login}</div>
        )}
      </td>
      {/* Service / Fonction */}
      <td className={td}>
        <div>{a.service ?? <Empty />}</div>
        {a.fonction && (
          <div className="text-[11px] text-muted-foreground">{a.fonction}</div>
        )}
      </td>
      {/* Responsable (+ email + société) */}
      <td className={td}>
        <div className="whitespace-nowrap">{a.responsable ?? <Empty />}</div>
        {a.responsableEmail && (
          <div className="font-mono text-[11px] text-muted-foreground">{a.responsableEmail}</div>
        )}
        {a.societe && (
          <div className="text-[11px] text-muted-foreground">{a.societe}</div>
        )}
      </td>
      {/* Tâches (LDAP / Logiciels / Téléphone) */}
      <td className={td}>
        <div className="flex w-32 flex-col gap-1">
          <TaskToggle icon={Network} label="LDAP" value={wf.compte_ldap} disabled={isClosed} onChange={v => onPatch({ compte_ldap: v })} />
          <TaskToggle icon={AppWindow} label="Logiciels" value={wf.logiciels_metiers} disabled={isClosed} onChange={v => onPatch({ logiciels_metiers: v })} />
          <TaskToggle icon={Phone} label="Téléphone" value={wf.telephone} disabled={isClosed} onChange={v => onPatch({ telephone: v })} />
        </div>
      </td>
      {/* Mot de passe */}
      <td className={`${td} whitespace-nowrap`}>
        {wf.mdp_envoye_at && (
          <div className="mb-1 flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckCircle2 size={11} />
            envoyé le {new Date(wf.mdp_envoye_at).toLocaleDateString('fr-FR')}
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="relative">
            <KeyRound size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={mdp}
              onChange={e => setMdp(e.target.value)}
              disabled={isClosed}
              placeholder="mot de passe"
              autoComplete="new-password"
              className="w-28 rounded border border-border bg-background pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={handleSendMdp}
            disabled={sending || isClosed || !mdp.trim() || !a.responsableEmail}
            title={!a.responsableEmail ? 'Email du responsable introuvable' : 'Envoyer au responsable'}
            className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
      </td>
      {/* Technicien */}
      <td className={td}>
        <select
          value={wf.technicien ?? ''}
          disabled={isClosed}
          onChange={e => onPatch({ technicien: e.target.value || null })}
          className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="">—</option>
          {TECHNICIANS.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </td>
      {/* Clôture */}
      <td className={`${td} whitespace-nowrap`}>
        {isClosed ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 size={12} /> Clôturé
          </span>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-50"
          >
            {closing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Clôturer
          </button>
        )}
      </td>
    </tr>
  );
}

const COLS = [
  'Ticket', 'Arrivée', 'Collaborateur', 'Service / Fonction', 'Responsable',
  'Tâches', 'Mot de passe', 'Technicien', 'Clôture',
];

export default function SupportArrivees() {
  const { data: arrivees = [], isFetching, isError, refetch } = useArrivees();
  const { data: workflow = {} } = useArriveesWorkflow();
  const updateWf = useUpdateArriveeWorkflow();
  const [showClosed, setShowClosed] = useState(false);

  const sorted = [...arrivees].sort((a, b) => {
    const da = parseDate(a.dateArrivee)?.getTime() ?? Infinity;
    const db = parseDate(b.dateArrivee)?.getTime() ?? Infinity;
    return da - db;
  });

  const isClosed = (a: Arrivee) =>
    workflow[a.id]?.cloture || CLOSED_STATUSES.has(a.status?.toLowerCase());

  const rows = showClosed ? sorted : sorted.filter(a => !isClosed(a));
  const closedCount = sorted.filter(isClosed).length;
  const upcoming = sorted.filter(a => {
    if (isClosed(a)) return false;
    const n = daysUntil(parseDate(a.dateArrivee));
    return n !== null && n >= 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Arrivées des nouveaux collaborateurs</h2>
            <p className="text-xs text-muted-foreground">
              Demandes de création de compte issues de RT
              {!isFetching && (
                <> — <span className="font-medium text-foreground">{upcoming}</span> à venir / {closedCount} clôturée{closedCount !== 1 ? 's' : ''}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            Afficher les clôturées
          </label>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Tableau */}
      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 text-left">
                {COLS.map(h => (
                  <th key={h} className="px-2.5 py-2.5 font-semibold border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <ArriveeRow
                  key={a.id}
                  a={a}
                  zebra={i % 2 === 1}
                  wf={workflow[a.id] ?? EMPTY_WF}
                  onPatch={patch => updateWf.mutate({ ticket_rt: a.id, ...patch })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* États */}
      {isError && (
        <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 py-12 text-center text-sm text-destructive">
          Impossible de récupérer les arrivées depuis RT.
        </div>
      )}
      {!isError && isFetching && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          Chargement des arrivées…
        </div>
      )}
      {!isError && !isFetching && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          {closedCount > 0 && !showClosed
            ? 'Aucune arrivée en cours. Cochez « Afficher les clôturées » pour voir l\'historique.'
            : 'Aucune arrivée à afficher pour le moment.'}
        </div>
      )}
    </div>
  );
}
