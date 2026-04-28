import { useState } from "react";
import { Archive, Upload, PlusCircle, UserCheck, MonitorX, Handshake, ClipboardList } from "lucide-react";
import StockInventoryTable from "@/components/stock/StockInventoryTable";
import StockDeviceTypeChart from "@/components/stock/StockDeviceTypeChart";
import StockWindowsVersionChart from "@/components/stock/StockWindowsVersionChart";
import StockEsetChart from "@/components/stock/StockEsetChart";
import StockAddAssetModal from "@/components/stock/StockAddAssetModal";
import StockAffecterModal from "@/components/stock/StockAffecterModal";
import StockDecommissionModal from "@/components/stock/StockDecommissionModal";
import StockPretModal from "@/components/stock/StockPretModal";
import DecommissionedListModal from "@/components/shared/DecommissionedListModal";

const Stock = () => {
  const [addOpen, setAddOpen] = useState(false);
  const [affecterOpen, setAffecterOpen] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [pretOpen, setPretOpen] = useState(false);
  const [decommListOpen, setDecommListOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <StockAddAssetModal open={addOpen} onClose={() => setAddOpen(false)} />
      <StockAffecterModal open={affecterOpen} onClose={() => setAffecterOpen(false)} />
      <StockDecommissionModal open={decommissionOpen} onClose={() => setDecommissionOpen(false)} />
      <StockPretModal open={pretOpen} onClose={() => setPretOpen(false)} />
      <DecommissionedListModal open={decommListOpen} onClose={() => setDecommListOpen(false)} />

      {/* Header + Navigation tabs */}
      <div className="sticky top-0 z-50 bg-card/50 backdrop-blur-sm border-b border-border">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
                  <Archive size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground">Parc - Stock</h1>
                  <p className="text-xs text-muted-foreground">Équipements en stock</p>
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
                  onClick={() => setPretOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 text-sm font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/20"
                >
                  <Handshake size={15} />
                  <span className="hidden sm:inline">Prêt</span>
                </button>
                <button
                  onClick={() => setDecommissionOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-medium text-orange-600 dark:text-orange-400 transition-colors hover:bg-orange-500/20"
                >
                  <MonitorX size={15} />
                  <span className="hidden sm:inline">Décommissionner</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation tabs */}
        <div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav className="flex gap-1 -mb-px">
              <a href="/" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                Parc - Siège et Groupes
              </a>
              <a href="/agences" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                Réseau Agences
              </a>
              <a href="/abcroisiere" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                ABcroisière
              </a>
              <a href="/stock" className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary">
                Stock
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <StockInventoryTable />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StockDeviceTypeChart />
          <StockWindowsVersionChart />
          <StockEsetChart />
        </div>
      </main>
    </div>
  );
};

export default Stock;
