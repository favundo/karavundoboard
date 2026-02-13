import { Monitor, Laptop, Users, UserX, Layers } from "lucide-react";
import { totalDevices, totalEmployees, absentEmployees, deviceTypeStats, employeesWithMultipleDevices } from "@/data/inventoryData";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel?: string;
  glowClass?: string;
}

const StatCard = ({ icon, label, value, sublabel, glowClass = "glow-primary" }: StatCardProps) => (
  <div className={`relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:scale-[1.02] hover:glow-border ${glowClass}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
    </div>
  </div>
);

const StatsCards = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        icon={<Layers size={20} />}
        label="Total Équipements"
        value={totalDevices}
        sublabel="Assets dans l'inventaire"
      />
      <StatCard
        icon={<Users size={20} />}
        label="Collaborateurs"
        value={totalEmployees}
        sublabel={`${employeesWithMultipleDevices} avec multi-devices`}
      />
      <StatCard
        icon={<Laptop size={20} />}
        label="Portables"
        value={deviceTypeStats.portable}
        sublabel={`${((deviceTypeStats.portable / totalDevices) * 100).toFixed(0)}% du parc`}
      />
      <StatCard
        icon={<Monitor size={20} />}
        label="PC Fixes"
        value={deviceTypeStats["Pc Fixe"]}
        sublabel={`${((deviceTypeStats["Pc Fixe"] / totalDevices) * 100).toFixed(0)}% du parc`}
      />
      <StatCard
        icon={<UserX size={20} />}
        label="Absents"
        value={absentEmployees}
        sublabel="Collaborateurs absents"
      />
    </div>
  );
};

export default StatsCards;
