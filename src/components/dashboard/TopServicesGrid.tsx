import { serviceStats } from "@/data/inventoryData";
import { Building2, Headphones, Code, Megaphone, Wallet, Users2 } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "Informatique": <Code size={18} />,
  "Relation Client": <Headphones size={18} />,
  "Production": <Building2 size={18} />,
  "Marketing": <Megaphone size={18} />,
  "Administration et Finance": <Wallet size={18} />,
  "Groupes": <Users2 size={18} />,
};

const top6 = Object.entries(serviceStats)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 6);

const maxVal = top6[0][1];

const TopServicesGrid = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Top services
      </h3>
      <div className="space-y-3">
        {top6.map(([name, count]) => (
          <div key={name} className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {iconMap[name] || <Building2 size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground truncate">{name}</span>
                <span className="text-xs font-bold text-primary ml-2">{count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${(count / maxVal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopServicesGrid;
