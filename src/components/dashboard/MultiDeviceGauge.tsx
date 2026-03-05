import { useInventory } from "@/hooks/useInventory";
import { Target, TrendingDown } from "lucide-react";

const MultiDeviceGauge = () => {
  const { data: inventory, isLoading } = useInventory();

  const items = inventory ?? [];
  const totalEmployees = new Set(items.filter((i) => i.uid).map((i) => i.uid)).size;

  const multiDeviceCount = (() => {
    const counts = new Map<string, number>();
    items.forEach((i) => {
      if (i.uid) counts.set(i.uid, (counts.get(i.uid) ?? 0) + 1);
    });
    return Array.from(counts.values()).filter((c) => c > 1).length;
  })();

  // 0 multi-device = 100% objective reached
  const percentage = totalEmployees > 0
    ? Math.round(((totalEmployees - multiDeviceCount) / totalEmployees) * 100)
    : 100;

  // SVG arc calculations
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on progress
  const getColor = () => {
    if (percentage >= 90) return "hsl(var(--glow-success))";
    if (percentage >= 70) return "hsl(var(--glow-warning))";
    return "hsl(var(--glow-danger))";
  };

  if (isLoading) {
    return (
      <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target size={16} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Objectif Mono-device
            </p>
          </div>
        </div>

        {/* Content: gauge + KPI */}
        <div className="flex items-center gap-5">
          {/* Circular gauge */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={strokeWidth}
              />
              {/* Progress arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={getColor()}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{percentage}%</span>
              <span className="text-[10px] text-muted-foreground">atteint</span>
            </div>
          </div>

          {/* KPI details */}
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-1.5">
                <TrendingDown size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Restants</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{multiDeviceCount}</p>
              <p className="text-[11px] text-muted-foreground">
                collaborateur{multiDeviceCount > 1 ? "s" : ""} multi-devices
              </p>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total collaborateurs</span>
              <span className="font-medium text-foreground">{totalEmployees}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiDeviceGauge;
