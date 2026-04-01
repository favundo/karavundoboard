import { useState } from "react";
import { Server, Upload, Trash2, MonitorX, PlusCircle, Handshake, UserCheck, Archive } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import ServiceChart from "@/components/dashboard/ServiceChart";
import DeviceTypeChart from "@/components/dashboard/DeviceTypeChart";
import TopServicesGrid from "@/components/dashboard/TopServicesGrid";
import WindowsVersionChart from "@/components/dashboard/WindowsVersionChart";
import EsetChart from "@/components/dashboard/EsetChart";
import MultiDeviceGauge from "@/components/dashboard/MultiDeviceGauge";
import InventoryTable from "@/components/dashboard/InventoryTable";
import ImportModal from "@/components/dashboard/ImportModal";
import PinModal from "@/components/dashboard/PinModal";
import ResetModal from "@/components/dashboard/ResetModal";
import DecommissionModal from "@/components/dashboard/DecommissionModal";
import AddAssetModal from "@/components/dashboard/AddAssetModal";
import PretModal from "@/components/dashboard/PretModal";
import AffecterModal from "@/components/dashboard/AffecterModal";
import StockModal from "@/components/dashboard/StockModal";

type PinAction = "import" | "reset" | "decommission";

const Index = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [pretOpen, setPretOpen] = useState(false);
  const [affecterOpen, setAffecterOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [pinAction, setPinAction] = useState<PinAction>("import");

  const openPinFor = (action: PinAction) => {
    setPinAction(action);
    setPinOpen(true);
  };

  const handlePinSuccess = () => {
    setPinOpen(false);
    if (pinAction === "import") setImportOpen(true);
    else if (pinAction === "reset") setResetOpen(true);
    else if (pinAction === "decommission") setDecommissionOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={handlePinSuccess} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} />
      <DecommissionModal open={decommissionOpen} onClose={() => setDecommissionOpen(false)} />
      <AddAssetModal open={addAssetOpen} onClose={() => setAddAssetOpen(false)} />
      <PretModal open={pretOpen} onClose={() => setPretOpen(false)} />
      <AffecterModal open={affecterOpen} onClose={() => setAffecterOpen(false)} />
      <StockModal open={stockOpen} onClose={() => setStockOpen(false)} />

      {/* Header + Navigation tabs — bloc sticky unique */}
      <div className="sticky top-0 z-50 bg-card/50 backdrop-blur-sm border-b border-border">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary glow-primary">
                <Server size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Parc - Siège et Groupes</h1>
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
                onClick={() => setAddAssetOpen(true)}
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
                onClick={() => setPretOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 text-sm font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/20"
              >
                <Handshake size={15} />
                <span className="hidden sm:inline">Prêt</span>
              </button>
              <button
                onClick={() => openPinFor("decommission")}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-medium text-orange-600 dark:text-orange-400 transition-colors hover:bg-orange-500/20"
              >
                <MonitorX size={15} />
                <span className="hidden sm:inline">Décommissionner</span>
              </button>
              <button
                onClick={() => openPinFor("import")}
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
      <div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1 -mb-px">
            <a
              href="/"
              className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary"
            >
              Parc - Siège et Groupes
            </a>
            <a
              href="/agences"
              className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border"
            >
              Réseau Agences
            </a>
            <a
              href="/abcroisiere"
              className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border"
            >
              ABcroisière
            </a>
          </nav>
        </div>
      </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <StatsCards />

        <InventoryTable />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ServiceChart />
          </div>
          <div className="space-y-6">
            <MultiDeviceGauge />
            <DeviceTypeChart />
            <WindowsVersionChart />
            <EsetChart />
            <TopServicesGrid />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

