import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { serviceStats, serviceColors } from "@/data/inventoryData";

const data = Object.entries(serviceStats)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 12)
  .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, fullName: name, value }));

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
        <p className="text-xs font-medium text-foreground">{payload[0].payload.fullName}</p>
        <p className="text-sm font-bold text-primary">{payload[0].value} équipements</p>
      </div>
    );
  }
  return null;
};

const ServiceChart = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Équipements par service
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(220, 15%, 14%)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {data.map((entry) => (
                <Cell
                  key={entry.fullName}
                  fill={serviceColors[entry.fullName] || serviceColors["Other"]}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ServiceChart;
