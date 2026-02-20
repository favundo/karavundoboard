import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAbcroisiereInventory } from "@/hooks/useAbcroisiereInventory";
import { useMemo } from "react";

const COLORS = ["hsl(190, 95%, 50%)", "hsl(160, 70%, 45%)"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
        <p className="text-xs font-medium text-foreground">{payload[0].name}</p>
        <p className="text-sm font-bold text-primary">{payload[0].value} unités</p>
      </div>
    );
  }
  return null;
};

const AbcroisiereDeviceTypeChart = () => {
  const { data: inventory } = useAbcroisiereInventory();

  const data = useMemo(() => {
    const items = inventory ?? [];
    return [
      { name: "Portables", value: items.filter((i) => i.type === "portable").length },
      { name: "PC Fixes", value: items.filter((i) => i.type === "Pc Fixe").length },
    ];
  }, [inventory]);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Répartition par type
      </h3>
      <div className="flex items-center gap-6">
        <div className="h-[200px] w-[200px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} fillOpacity={0.9} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
              <div>
                <p className="text-sm font-medium text-foreground">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.value} ({total ? ((entry.value / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AbcroisiereDeviceTypeChart;
