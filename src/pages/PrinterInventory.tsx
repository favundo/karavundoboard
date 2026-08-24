import { useState } from "react";
import { Printer, PlusCircle, Trash2, Upload } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import PrinterInventoryTable from "@/components/printer/PrinterInventoryTable";
import PrinterAddModal from "@/components/printer/PrinterAddModal";
import PrinterDeleteModal from "@/components/printer/PrinterDeleteModal";
import PrinterImportModal from "@/components/printer/PrinterImportModal";
import { AdminOnly } from "@/components/AdminOnly";

const PrinterInventory = () => {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <PrinterAddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PrinterDeleteModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      <PrinterImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Header + Navigation tabs — bloc sticky unique */}
      <div className="sticky top-0 z-40 bg-card/50 backdrop-blur-sm border-b border-border">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary glow-primary">
                  <Printer size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground">Imprimantes Siège</h1>
                  <p className="text-xs text-muted-foreground">Inventaire des imprimantes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Données à jour
                  </span>
                </div>
                <ThemeToggle />
                <AdminOnly>
                  <button
                    onClick={() => setImportOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Upload size={15} />
                    <span className="hidden sm:inline">Importer</span>
                  </button>
                </AdminOnly>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 text-sm font-medium text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/20"
                >
                  <PlusCircle size={15} />
                  <span className="hidden sm:inline">Ajouter</span>
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Trash2 size={15} />
                  <span className="hidden sm:inline">Supprimer</span>
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
                Parc Siège
              </a>
              <a href="/groupes-province" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                Groupes Province
              </a>
              <a href="/agences" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                Réseau Agences
              </a>
              <a href="/abcroisiere" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                ABcroisière
              </a>
              <a href="/stock" className="px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border">
                Stock
              </a>
              <a href="/imprimantes-siege" className="px-4 py-3 text-xs font-medium text-primary border-b-2 border-primary">
                Imprimantes Siège
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <PrinterInventoryTable />
      </main>
    </div>
  );
};

export default PrinterInventory;
