import { Network, Building2, Server, Hash } from "lucide-react";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";

const AgencyStatsCards = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  const totalEquipements = items.length;
  const totalAgences = new Set(items.map((i) => i.agence)).size;
  const totalReseaux = new Set(items.map((i) => i.sous_reseau).filter(Boolean)).size;
  const sansSN = items.filter((i) => !i.sn).length;

  const cards = [
    { label: "Équipements", value: totalEquipements, icon: Server, color: "text-primary", bg: "bg-primary/10" },
    { label: "Agences", value: totalAgences, icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Sous-réseaux", value: totalReseaux, icon: Network, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Sans N° Série", value: sansSN, icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
    </div>
  );
};

export default AgencyStatsCards;
