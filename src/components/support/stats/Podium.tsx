import { useEffect, useState } from 'react';
import { Crown, Timer, Zap } from 'lucide-react';
import { type RTOwnerStats } from '@/hooks/useRTStats';
import { formatHours, ownerColor, ownerInitials, ownerLabel, pct } from './format';
import { type VizPalette } from '@/lib/vizColors';

const MEDALS = ['🥇', '🥈', '🥉'];
/** Ordre d'affichage : le 2ᵉ à gauche, le 1ᵉʳ au centre, le 3ᵉ à droite. */
const VISUAL_ORDER = [1, 0, 2];

const Avatar = ({ login, size }: { login: string; size: number }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
    style={{ backgroundColor: ownerColor(login), width: size, height: size, fontSize: size * 0.36 }}
    aria-hidden
  >
    {ownerInitials(login)}
  </span>
);

interface PodiumProps {
  owners: RTOwnerStats[];
  palette: VizPalette;
}

/**
 * Podium + classement. Les barres portent une teinte unique : le rang est déjà
 * dit par la position et par le nombre affiché, la couleur n'encode donc rien.
 * La pastille colorée à côté du nom, elle, suit le technicien (mêmes couleurs
 * que le planning support) et n'est jamais seule à identifier quelqu'un.
 */
export const Podium = ({ owners, palette }: PodiumProps) => {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);

  const ranked = owners.filter((o) => o.owner !== 'Nobody');
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3).filter((o) => o.resolved > 0);
  const max = ranked[0]?.resolved || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Classement — tickets résolus
      </h3>

      {/* Podium */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {VISUAL_ORDER.map((rank) => {
          const o = top3[rank];
          if (!o) return <div key={rank} />;
          const height = 56 + (o.resolved / max) * 84;
          return (
            <div key={o.owner} className="flex flex-col items-center text-center">
              <span className="text-2xl sm:text-3xl" aria-hidden>{MEDALS[rank]}</span>
              <Avatar login={o.owner} size={rank === 0 ? 48 : 40} />
              <p className="mt-2 truncate text-sm font-semibold text-foreground max-w-full">{ownerLabel(o.owner)}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{o.resolved}</p>
              <p className="text-[11px] text-muted-foreground">{pct(o.share)} du total</p>

              <div
                className="mt-2 w-full rounded-t-md transition-[height] duration-700 ease-out"
                style={{
                  height: grown ? height : 0,
                  backgroundColor: palette.resolved,
                  opacity: rank === 0 ? 1 : 0.75,
                }}
              />
              <div className="w-full rounded-b-md border-x border-b border-border bg-muted/30 px-2 py-1.5">
                <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1" title="Délai médian de résolution">
                    <Timer size={11} /> {formatHours(o.medianHours)}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Part de tickets résolus le jour même">
                    <Zap size={11} /> {pct(o.sameDayPct)}
                  </span>
                  {o.crowns > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title={`${o.crowns} mois terminé(s) en tête`}>
                      <Crown size={11} /> {o.crowns}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suite du classement */}
      {rest.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-border pt-4">
          {rest.map((o, i) => (
            <li key={o.owner} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 4}</span>
              <Avatar login={o.owner} size={24} />
              <span className="w-28 shrink-0 truncate text-sm text-foreground sm:w-36">{ownerLabel(o.owner)}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: grown ? `${(o.resolved / max) * 100}%` : 0, backgroundColor: palette.resolved, opacity: 0.75 }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{o.resolved}</span>
              <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                {formatHours(o.medianHours)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
