import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAbcroisiereInventory } from "@/hooks/useAbcroisiereInventory";

const normalizeVersion = (v: string): string => {
  if (!v || v.trim() === "") return "Inconnu";
  const lower = v.toLowerCase();
  if (lower.includes("11")) return "Windows 11";
  if (lower.includes("10")) return "Windows 10";
  if (lower.includes("8.1")) return "Windows 8.1";
  if (lower.includes("8")) return "Windows 8";
  if (lower.includes("7")) return "Windows 7";
  return "Autre";
};

const COLORS: Record<string, string> = {
  "Windows 11": "hsl(var(--primary))",
  "Windows 10": "hsl(var(--chart-2))",
  "Windows 8.1": "hsl(var(--chart-3))",
  "Windows 8": "hsl(var(--chart-4))",
  "Windows 7": "hsl(var(--chart-5))",
  "Autre": "hsl(var(--muted-foreground))",
  "Inconnu": "hsl(var(--border))",
};

const FALLBACK_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))", "hsl(var(--border))",
];

const CustomTooltip = ({ active, payload, total }: { active?: boolean; payload?: any[]; total: number }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">{value} équipement{value > 1 ? "s" : ""}</p>
      <p className="text-primary font-medium">{pct}%</p>
    </div>
  );
};

const AbcroisiereWindowsVersionChart = () => {
  const { data: inventory, isLoading } = useAbcroisiereInventory();

  const chartData = useMemo(() => {
    if (!inventory) return [];
    const counts: Record<string, number> = {};
    for (const item of inventory) {
      const label = normalizeVersion(item.windows_version ?? "");
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inventory]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Versions Windows</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{total} équipements</p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Chargement…</div>
      ) : chartData.length === 0 || (chartData.length === 1 && chartData[0].name === "Inconnu") ? (
        <div className="flex h-48 items-center justify-center text-center text-xs text-muted-foreground px-4">
          Aucune donnée Windows — importez votre fichier Excel pour remplir ce champ.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[entry.name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {chartData.map((entry, index) => {
              const color = COLORS[entry.name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
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

export default AbcroisiereWindowsVersionChart;
