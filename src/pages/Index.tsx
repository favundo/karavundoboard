import { useState } from "react";
import { Server, Upload } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import ServiceChart from "@/components/dashboard/ServiceChart";
import DeviceTypeChart from "@/components/dashboard/DeviceTypeChart";
import TopServicesGrid from "@/components/dashboard/TopServicesGrid";
import InventoryTable from "@/components/dashboard/InventoryTable";
import ImportModal from "@/components/dashboard/ImportModal";

const Index = () => {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary glow-primary">
                <Server size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Parc IT — Siège</h1>
                <p className="text-xs text-muted-foreground">Inventaire du parc informatique</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Données à jour
                </span>
              </div>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Upload size={15} />
                <span className="hidden sm:inline">Mettre à jour</span>
                <span className="sm:hidden">Import</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <StatsCards />
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ServiceChart />
          </div>
          <div className="space-y-6">
            <DeviceTypeChart />
            <TopServicesGrid />
          </div>
        </div>

        <InventoryTable />
      </main>
    </div>
  );
};

export default Index;

