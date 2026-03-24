import { useState } from "react";
import { Server, Upload, Trash2 } from "lucide-react";
import WebhookSettings from "@/components/dashboard/WebhookSettings";
import AbcroisiereStatsCards from "@/components/abcroisiere/AbcroisiereStatsCards";
import AbcroisiereServiceChart from "@/components/abcroisiere/AbcroisiereServiceChart";
import AbcroisiereDeviceTypeChart from "@/components/abcroisiere/AbcroisiereDeviceTypeChart";
import AbcroisiereTopServicesGrid from "@/components/abcroisiere/AbcroisiereTopServicesGrid";
import AbcroisiereWindowsVersionChart from "@/components/abcroisiere/AbcroisiereWindowsVersionChart";
import AbcroisiereEsetChart from "@/components/abcroisiere/AbcroisiereEsetChart";
import AbcroisiereInventoryTable from "@/components/abcroisiere/AbcroisiereInventoryTable";
import AbcroisiereImportModal from "@/components/abcroisiere/AbcroisiereImportModal";
import AbcroisiereResetModal from "@/components/abcroisiere/AbcroisiereResetModal";
import PinModal from "@/components/dashboard/PinModal";

type PinAction = "import" | "reset";

const Abcroisiere = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinAction, setPinAction] = useState<PinAction>("import");

  const openPinFor = (action: PinAction) => {
    setPinAction(action);
    setPinOpen(true);
  };

  const handlePinSuccess = () => {
    setPinOpen(false);
    if (pinAction === "import") setImportOpen(true);
    else setResetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={handlePinSuccess} />
      <AbcroisiereImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AbcroisiereResetModal open={resetOpen} onClose={() => setResetOpen(false)} />

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
              <WebhookSettings />
              <button
                onClick={() => openPinFor("reset")}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 size={15} />
                <span className="hidden sm:inline">Vider</span>
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
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <AbcroisiereStatsCards />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AbcroisiereServiceChart />
          </div>
          <div className="space-y-6">
            <AbcroisiereDeviceTypeChart />
            <AbcroisiereWindowsVersionChart />
            <AbcroisiereEsetChart />
            <AbcroisiereTopServicesGrid />
          </div>
        </div>

        <AbcroisiereInventoryTable />
      </main>
    </div>
  );
};

export default Abcroisiere;
