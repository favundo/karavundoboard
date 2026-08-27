import { getTechnicianById } from '@/lib/technicians';

const NEUTRAL = 'hsl(215 16% 55%)';

export const ownerLabel = (login: string) =>
  login === 'Nobody' ? 'Non assigné' : getTechnicianById(login)?.label ?? login;

/** Couleur d'identité du technicien — la même que dans le planning support. */
export const ownerColor = (login: string) =>
  login === 'Nobody' ? NEUTRAL : getTechnicianById(login)?.bgColor ?? NEUTRAL;

export const ownerInitials = (login: string) => {
  const label = ownerLabel(login);
  const parts = label.replace('.', '').split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : label.slice(0, 2)).toUpperCase();
};

/** 5.1 → « 5 h » ; 46 → « 1 j 22 h » ; 850 → « 35 j ». */
export function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
  let days = Math.floor(h / 24);
  let rest = Math.round(h % 24);
  if (rest === 24) { days += 1; rest = 0; }   // 239,6 h → 10 j, pas « 9 j 24 h »
  if (days >= 10) return `${days} j`;
  return rest ? `${days} j ${rest} h` : `${days} j`;
}

export const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Demande réelle : les entrées moins celles qui ont fini rejetées. Un rejet est
 * quasi toujours du spam ou un ticket mal aiguillé — pas une demande adressée à
 * l'équipe. Les compter au dénominateur ferait passer l'équipe pour débordée.
 * Le `?? 0` couvre un serveur pas encore à jour.
 */
export const realDemand = (t: { created: number; rejectedCreated?: number }) =>
  t.created - (t.rejectedCreated ?? 0);

/** Part des entrées qui ont fini rejetées — le signal d'une file mal aiguillée. */
export const rejectRate = (t: { created: number; rejectedCreated?: number }) =>
  t.created ? (t.rejectedCreated ?? 0) / t.created : 0;

export const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
