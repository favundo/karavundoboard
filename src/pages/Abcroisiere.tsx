import { useState } from "react";
import { Server, Upload, PlusCircle, UserCheck, Archive, MonitorX, ClipboardList } from "lucide-react";
import AbcroisiereStatsCards from "@/components/abcroisiere/AbcroisiereStatsCards";
import AbcroisiereServiceChart from "@/components/abcroisiere/AbcroisiereServiceChart";
import AbcroisiereDeviceTypeChart from "@/components/abcroisiere/AbcroisiereDeviceTypeChart";
import AbcroisiereWindowsVersionChart from "@/components/abcroisiere/AbcroisiereWindowsVersionChart";
import AbcroisiereEsetChart from "@/components/abcroisiere/AbcroisiereEsetChart";
import AbcroisiereInventoryTable from "@/components/abcroisiere/AbcroisiereInventoryTable";
import AbcroisiereImportModal from "@/components/abcroisiere/AbcroisiereImportModal";
import AbcroisiereAddAssetModal from "@/components/abcroisiere/AbcroisiereAddAssetModal";
import AbcroisiereAffecterModal from "@/components/abcroisiere/AbcroisiereAffecterModal";
import AbcroisiereStockModal from "@/components/abcroisiere/AbcroisiereStockModal";
import AbcroisiereDecommissionModal from "@/components/abcroisiere/AbcroisiereDecommissionModal";
import DecommissionedListModal from "@/components/shared/DecommissionedListModal";

const Abcroisiere = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [affecterOpen, setAffecterOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [decommListOpen, setDecommListOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AbcroisiereImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AbcroisiereAddAssetModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AbcroisiereAffecterModal open={affecterOpen} onClose={() => setAffecterOpen(false)} />
      <AbcroisiereStockModal open={stockOpen} onClose={() => setStockOpen(false)} />
      <AbcroisiereDecommissionModal open={decommissionOpen} onClose={() => setDecommissionOpen(false)} />
      <DecommissionedListModal open={decommListOpen} onClose={() => setDecommListOpen(false)} />

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Server size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Parc IT — ABcroisière</h1>
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
                onClick={() => setDecommListOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                title="PC Décommissionnés"
              >
                <ClipboardList size={15} />
                <span className="hidden sm:inline">Rebut</span>
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 text-sm font-medium text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/20"
              >
                <PlusCircle size={15} />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
              <button
                onClick={() => setAffecterOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 text-sm font-medium text-violet-600 dark:text-violet-400 transition-colors hover:bg-violet-500/20"
              >
                <UserCheck size={15} />
                <span className="hidden sm:inline">Affecter</span>
              </button>
              <button
                onClick={() => setStockOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 text-sm font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-500/20"
              >
                <Archive size={15} />
                <span className="hidden sm:inline">Stock</span>
              </button>
              <button
                onClick={() => setDecommissionOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-medium text-orange-600 dark:text-orange-400 transition-colors hover:bg-orange-500/20"
              >
                <MonitorX size={15} />
                <span className="hidden sm:inline">Décommissionner</span>
              </button>
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

      {/* Navigation tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1 -mb-px">
            <a href="/" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
              Parc - Siège et Groupes
            </a>
            <a href="/agences" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
              Réseau Agences
            </a>
            <a href="/abcroisiere" className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary">
              ABcroisière
            </a>
            <a href="/stock" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
              Stock
            </a>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <AbcroisiereStatsCards />

        <AbcroisiereInventoryTable />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <AbcroisiereDeviceTypeChart />
          <AbcroisiereWindowsVersionChart />
          <AbcroisiereEsetChart />
        </div>

        <AbcroisiereServiceChart />
      </main>
    </div>
  );
};

export default Abcroisiere;
