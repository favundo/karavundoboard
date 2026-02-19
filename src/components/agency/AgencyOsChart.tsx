import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

const normalizeOs = (v: string): string => {
  if (!v || v.trim() === "") return "Inconnu";
  const l = v.toLowerCase();
  if (l.includes("11")) return "Windows 11";
  if (l.includes("10")) return "Windows 10";
  if (l.includes("8.1")) return "Windows 8.1";
  if (l.includes("7")) return "Windows 7";
  if (l.includes("server")) return "Windows Server";
  return v.trim();
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { percent: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">{value} équipement{value > 1 ? "s" : ""}</p>
      <p className="text-primary font-medium">{(p.percent * 100).toFixed(1)}%</p>
    </div>
  );
};

const AgencyOsChart = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const label = normalizeOs(item.os_version ?? "");
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const hasData = chartData.length > 0 && !(chartData.length === 1 && chartData[0].name === "Inconnu");

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Versions OS
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isLoading ? "…" : `${total} équipements`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Chargement…</div>
      ) : !hasData ? (
        <div className="flex h-48 items-center justify-center text-center text-xs text-muted-foreground px-4">
          Aucune donnée OS — re-importez votre fichier avec la colonne version OS.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-3 space-y-1.5">
            {chartData.map((entry, index) => {
              const color = COLORS[index % COLORS.length];
              const pct = ((entry.value / total) * 100).toFixed(1);
              return (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-foreground">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{pct}%</span>
                    <span>({entry.value})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AgencyOsChart;
