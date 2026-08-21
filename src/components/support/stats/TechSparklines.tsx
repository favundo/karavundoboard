import { type RTOwnerStats } from '@/hooks/useRTStats';
import { formatHours, MONTH_LABELS, ownerColor, ownerLabel } from './format';

interface Props {
  owners: RTOwnerStats[];
  /** Nombre de mois réellement écoulés (les mois à venir ne sont pas affichés). */
  monthsElapsed: number;
}

/**
 * Petits multiples : une seule série par vignette, titrée par le nom du
 * technicien. La couleur reprend celle du planning support — comme il n'y a
 * jamais deux séries dans un même cadre, elle sert d'identité, pas de code.
 * L'échelle verticale est commune à toutes les vignettes : elles sont comparables.
 */
export const TechSparklines = ({ owners, monthsElapsed }: Props) => {
  const shown = owners.filter((o) => o.owner !== 'Nobody' && o.resolved >= 20);
  const max = Math.max(1, ...shown.flatMap((o) => o.months.slice(0, monthsElapsed)));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Mois par mois, par technicien
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">Même échelle verticale partout (max {max}/mois)</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((o) => {
          const series = o.months.slice(0, monthsElapsed);
          const best = Math.max(...series);
          return (
            <div key={o.owner} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ownerColor(o.owner) }} aria-hidden />
                  {ownerLabel(o.owner)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {o.resolved} · méd. {formatHours(o.medianHours)}
                </span>
              </div>
              <div className="flex h-16 items-end gap-[3px]">
                {series.map((n, i) => (
                  <span
                    key={i}
                    className="group relative flex-1"
                    title={`${MONTH_LABELS[i]} — ${n} ticket${n > 1 ? 's' : ''}`}
                  >
                    <span
                      className="block w-full rounded-t-[3px]"
                      style={{
                        height: `${Math.max(2, (n / max) * 64)}px`,
                        backgroundColor: ownerColor(o.owner),
                        opacity: n === best && n > 0 ? 1 : 0.55,
                      }}
                    />
                  </span>
                ))}
              </div>
              <div className="mt-1 flex gap-[3px]">
                {series.map((_, i) => (
                  <span key={i} className="flex-1 text-center text-[8px] text-muted-foreground">
                    {MONTH_LABELS[i][0]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
