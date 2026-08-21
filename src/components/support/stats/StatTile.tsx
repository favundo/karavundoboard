import { type LucideIcon } from 'lucide-react';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  /** Accent discret sur l'icône — jamais porteur d'information à lui seul. */
  tone?: 'neutral' | 'good' | 'warning';
}

const TONES = {
  neutral: 'bg-primary/10 text-primary',
  good:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

/**
 * Chiffre isolé : pas de graphique, la valeur EST l'information. Le libellé et
 * l'indice restent en encre de texte, jamais en couleur de série.
 */
export const StatTile = ({ icon: Icon, label, value, hint, tone = 'neutral' }: StatTileProps) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
        <Icon size={14} />
      </span>
    </div>
    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </div>
);
