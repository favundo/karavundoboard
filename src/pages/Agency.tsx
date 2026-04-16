import { useState } from "react";
import { Network, Upload, PlusCircle, MapPin, MapPinOff, Archive, MonitorX, ClipboardList } from "lucide-react";
import AgencyStatsCards from "@/components/agency/AgencyStatsCards";
import AgencyMap from "@/components/agency/AgencyMap";
import AgencyTable from "@/components/agency/AgencyTable";
import AgencyImportModal from "@/components/agency/AgencyImportModal";
import AgencyAddModal from "@/components/agency/AgencyAddModal";
import AgencyNouvelleAgenceModal from "@/components/agency/AgencyNouvelleAgenceModal";
import AgencySupprimerAgenceModal from "@/components/agency/AgencySupprimerAgenceModal";
import AgencyStockModal from "@/components/agency/AgencyStockModal";
import AgencyDecommissionModal from "@/components/agency/AgencyDecommissionModal";
import AgencyEsetChart from "@/components/agency/AgencyEsetChart";
import DecommissionedListModal from "@/components/shared/DecommissionedListModal";
import { AGENCES as BASE_AGENCES } from "@/components/agency/agencesBase";

const CUSTOM_AGENCES_KEY = "kar-custom-agences";
const SUPPRESSED_AGENCES_KEY = "kar-suppressed-agences";

const loadList = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); }
  catch { return []; }
};

const Agency = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [nouvelleAgenceOpen, setNouvelleAgenceOpen] = useState(false);
  const [supprimerAgenceOpen, setSupprimerAgenceOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [decommListOpen, setDecommListOpen] = useState(false);
  const [customAgences, setCustomAgences] = useState<string[]>(() => loadList(CUSTOM_AGENCES_KEY));
  const [suppressedAgences, setSuppressedAgences] = useState<string[]>(() => loadList(SUPPRESSED_AGENCES_KEY));

  const allAgences = [...new Set([...BASE_AGENCES, ...customAgences])]
    .filter((a) => !suppressedAgences.includes(a))
    .sort();

  const handleAddAgence = (nom: string) => {
    const updated = [...new Set([...customAgences, nom])].sort();
    setCustomAgences(updated);
    localStorage.setItem(CUSTOM_AGENCES_KEY, JSON.stringify(updated));
  };

  const handleSupprimerAgence = (nom: string) => {
    const updated = [...new Set([...suppressedAgences, nom])];
    setSuppressedAgences(updated);
    localStorage.setItem(SUPPRESSED_AGENCES_KEY, JSON.stringify(updated));
    // Si c'était une agence custom, la retirer aussi
    const updatedCustom = customAgences.filter((a) => a !== nom);
    setCustomAgences(updatedCustom);
    localStorage.setItem(CUSTOM_AGENCES_KEY, JSON.stringify(updatedCustom));
  };

  return (
    <div className="min-h-screen bg-background">
      <AgencyImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AgencyAddModal open={addOpen} onClose={() => setAddOpen(false)} extraAgences={allAgences} />
      <AgencyNouvelleAgenceModal open={nouvelleAgenceOpen} onClose={() => setNouvelleAgenceOpen(false)} onAdd={handleAddAgence} />
      <AgencySupprimerAgenceModal open={supprimerAgenceOpen} onClose={() => setSupprimerAgenceOpen(false)} agences={allAgences} onSupprimer={handleSupprimerAgence} />
      <AgencyStockModal open={stockOpen} onClose={() => setStockOpen(false)} />
      <AgencyDecommissionModal open={decommissionOpen} onClose={() => setDecommissionOpen(false)} />
      <DecommissionedListModal open={decommListOpen} onClose={() => setDecommListOpen(false)} />

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
                onClick={() => setDecommListOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                title="PC Décommissionnés"
              >
                <ClipboardList size={15} />
                <span className="hidden sm:inline">Rebut</span>
              </button>
              <button
                onClick={() => setNouvelleAgenceOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 text-sm font-medium text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-500/20"
              >
                <MapPin size={15} />
                <span className="hidden sm:inline">Nvlle agence</span>
              </button>
              <button
                onClick={() => setSupprimerAgenceOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-medium text-orange-600 dark:text-orange-400 transition-colors hover:bg-orange-500/20"
              >
                <MapPinOff size={15} />
                <span className="hidden sm:inline">Sup. agence</span>
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 text-sm font-medium text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/20"
              >
                <PlusCircle size={15} />
                <span className="hidden sm:inline">Ajouter</span>
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
            <a href="/agences" className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary">
              Réseau Agences
            </a>
            <a href="/abcroisiere" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
              ABcroisière
            </a>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <AgencyStatsCards totalAgences={allAgences.length} />
        <AgencyMap />
        <AgencyTable />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <AgencyEsetChart />
        </div>
      </main>
    </div>
  );
};

export default Agency;
