import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.8)",
  "hsl(var(--primary) / 0.65)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.25)",
  "hsl(var(--primary) / 0.2)",
];

const AgencyTopChart = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    if (item.agence) acc[item.agence] = (acc[item.agence] ?? 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([agence, count]) => ({ agence: agence.replace(/-/g, "\u2011"), count }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Top agences — équipements
      </h3>
      {isLoading || chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          {isLoading ? "Chargement…" : "Aucune donnée"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="agence" tick={{ fontSize: 9 }} width={140} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default AgencyTopChart;
