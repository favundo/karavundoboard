import { useState } from 'react';
import { DAY_LABELS } from './format';
import { heatColor, type VizPalette } from '@/lib/vizColors';

interface Props {
  /** [jour 0=lundi][heure 0-23] → nombre de tickets résolus */
  heat: number[][];
  palette: VizPalette;
}

/**
 * Quand l'équipe clôture réellement ses tickets. Rampe séquentielle d'une seule
 * teinte : la magnitude se lit par l'intensité, pas par un arc-en-ciel.
 */
export const ResolutionHeatmap = ({ heat, palette }: Props) => {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...heat.flat());
  const total = heat.flat().reduce((s, n) => s + n, 0);

  const peak = heat.flatMap((row, d) => row.map((n, h) => ({ d, h, n })))
    .reduce((best, cur) => (cur.n > best.n ? cur : best), { d: 0, h: 0, n: 0 });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Rythme des clôtures
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>0</span>
          {palette.heat.map((c) => (
            <span key={c} className="h-3 w-4 rounded-sm" style={{ backgroundColor: c }} aria-hidden />
          ))}
          <span>{max}</span>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Pic à <span className="font-semibold text-foreground">{DAY_LABELS[peak.d]} {String(peak.h).padStart(2, '0')} h</span> ({peak.n} tickets sur l'année)
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Échelle horaire */}
          <div className="mb-1 flex gap-[2px] pl-9">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="w-full text-center text-[9px] tabular-nums text-muted-foreground">
                {h % 3 === 0 ? h : ''}
              </span>
            ))}
          </div>
          {heat.map((row, d) => (
            <div key={d} className="mb-[2px] flex items-center gap-[2px]">
              <span className="w-9 shrink-0 text-[10px] text-muted-foreground">{DAY_LABELS[d]}</span>
              {row.map((n, h) => (
                <span
                  key={h}
                  className="relative h-5 w-full cursor-default rounded-sm border border-border/40 transition-transform hover:scale-110"
                  style={{ backgroundColor: n ? heatColor(n, max, palette) : 'transparent' }}
                  onMouseEnter={() => setHover({ d, h })}
                  onMouseLeave={() => setHover(null)}
                  title={`${DAY_LABELS[d]} ${String(h).padStart(2, '0')}h — ${n} ticket${n > 1 ? 's' : ''}`}
                >
                  {hover?.d === d && hover?.h === h && n > 0 && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-[11px] shadow-xl">
                      <span className="font-semibold text-foreground">{n}</span>
                      <span className="text-muted-foreground"> · {DAY_LABELS[d]} {String(h).padStart(2, '0')} h</span>
                    </span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{total} clôtures réparties sur 7 × 24 créneaux</p>
    </div>
  );
};
