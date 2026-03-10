import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";

const normalizeOs = (v: string): "win11" | "win10" | "other" => {
  if (!v) return "other";
  const l = v.toLowerCase();
  if (l.includes("11")) return "win11";
  if (l.includes("10")) return "win10";
  return "other";
};

type AgencyStatus = "Windows 11" | "Windows 10" | "Mixte";

const STATUS_COLORS: Record<AgencyStatus, string> = {
  "Windows 11": "hsl(var(--primary))",
  "Windows 10": "hsl(var(--chart-2))",
  "Mixte": "hsl(var(--chart-4))",
};

const CustomTooltip = ({ active, payload, totalAgencies }: { active?: boolean; payload?: any[]; totalAgencies: number }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const pct = totalAgencies > 0 ? ((value / totalAgencies) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">{value} agence{value > 1 ? "s" : ""} ({pct}%)</p>
    </div>
  );
};

const AgencyOsMigrationChart = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  const { chartData, totalAgencies } = useMemo(() => {
    // Group assets by agency
    const agencyAssets: Record<string, Set<string>> = {};
    for (const item of items) {
      if (!item.agence) continue;
      if (!agencyAssets[item.agence]) {
        agencyAssets[item.agence] = new Set();
      }
      agencyAssets[item.agence].add(normalizeOs(item.os_version ?? ""));
    }

    let win11 = 0;
    let win10 = 0;
    let mixte = 0;

    for (const versions of Object.values(agencyAssets)) {
      const hasW11 = versions.has("win11");
      const hasW10 = versions.has("win10");
      const hasOther = versions.has("other");

      if (hasW11 && !hasW10 && !hasOther) {
        win11++;
      } else if (hasW10 && !hasW11 && !hasOther) {
        win10++;
      } else {
        mixte++;
      }
    }

    const total = Object.keys(agencyAssets).length;

    return {
      chartData: [
        { name: "Windows 11", value: win11 },
        { name: "Windows 10", value: win10 },
        { name: "Mixte", value: mixte },
      ] as { name: AgencyStatus; value: number }[],
      totalAgencies: total,
    };
  }, [items]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 h-full flex flex-col">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">Migration OS par agence</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isLoading ? "…" : `${totalAgencies} agences`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Chargement…</div>
      ) : totalAgencies === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Aucune donnée</div>
      ) : (
        <>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip totalAgencies={totalAgencies} />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex gap-3 flex-wrap">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.name] }} />
                <span className="text-muted-foreground">{entry.name}</span>
                <span className="font-semibold text-foreground">{entry.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgencyOsMigrationChart;
