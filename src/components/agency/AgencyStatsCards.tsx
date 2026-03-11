import { Building2, Server } from "lucide-react";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";
import AgencyOsChart from "./AgencyOsChart";
import AgencyOsMigrationChart from "./AgencyOsMigrationChart";
import AgencyAioMigrationChart from "./AgencyAioMigrationChart";

const AgencyStatsCards = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  const totalEquipements = items.length;
  const totalAgences = new Set(items.map((i) => i.agence).filter(Boolean)).size;

  const cards = [
    { label: "Équipements", value: totalEquipements, icon: Server, color: "text-primary", bg: "bg-primary/10" },
    { label: "Agences", value: totalAgences, icon: Building2, color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* 2 stat cards + 2 migration charts */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? "…" : card.value.toLocaleString("fr-FR")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.label}</p>
            </div>
          </div>
        ))}
        <AgencyOsMigrationChart />
        <AgencyAioMigrationChart />
      </div>
      {/* OS chart taking 1 column */}
      <div className="lg:col-span-1">
        <AgencyOsChart />
      </div>
    </div>
  );
};

export default AgencyStatsCards;

