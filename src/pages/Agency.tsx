import { useState } from "react";
import { Network, Upload } from "lucide-react";
import AgencyStatsCards from "@/components/agency/AgencyStatsCards";
import AgencyTopChart from "@/components/agency/AgencyTopChart";
import AgencyTable from "@/components/agency/AgencyTable";
import AgencyImportModal from "@/components/agency/AgencyImportModal";
import PinModal from "@/components/dashboard/PinModal";

const Agency = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <PinModal
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={() => { setPinOpen(false); setImportOpen(true); }}
      />
      <AgencyImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Network size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Réseau Agences</h1>
                <p className="text-xs text-muted-foreground">Inventaire du parc informatique agences</p>
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
                onClick={() => setPinOpen(true)}
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

      {/* Navigation tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1 -mb-px">
            <a
              href="/"
              className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border"
            >
              Parc IT — Siège
            </a>
            <a
              href="/agences"
              className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary"
            >
              Réseau Agences
            </a>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <AgencyStatsCards />
        <AgencyTopChart />
        <AgencyTable />
      </main>
    </div>
  );
};

export default Agency;
