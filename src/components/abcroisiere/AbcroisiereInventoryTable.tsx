import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Laptop, Monitor, AlertCircle, FileText, FileSpreadsheet, Upload, Users } from "lucide-react";
import { type InventoryItem } from "@/data/inventoryData";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useAbcroisiereInventory } from "@/hooks/useAbcroisiereInventory";
import AbcroisiereImportModal from "./AbcroisiereImportModal";
import MultiDeviceModal from "@/components/dashboard/MultiDeviceModal";

type SortKey = keyof InventoryItem;

const AbcroisiereInventoryTable = () => {
  const { data: inventoryFromDb, isLoading } = useAbcroisiereInventory();
  const [importOpen, setImportOpen] = useState(false);
  const [multiDeviceOpen, setMultiDeviceOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const inventoryData: InventoryItem[] = inventoryFromDb ?? [];

  const services = useMemo(
    () => ["Tous", ...Array.from(new Set(inventoryData.map((i) => i.service))).sort()],
    [inventoryData]
  );

  const filtered = useMemo(() => {
    return inventoryData
      .filter((item) => {
        const matchSearch =
          !search ||
          item.nom.toLowerCase().includes(search.toLowerCase()) ||
          item.uid.toLowerCase().includes(search.toLowerCase()) ||
          item.asset.toLowerCase().includes(search.toLowerCase()) ||
          item.sn.toLowerCase().includes(search.toLowerCase());
        const matchService = serviceFilter === "Tous" || item.service === serviceFilter;
        const matchType = typeFilter === "Tous" || item.type === typeFilter;
        return matchSearch && matchService && matchType;
      })
      .sort((a, b) => {
        const valA = a[sortKey] ?? "";
        const valB = b[sortKey] ?? "";
        const cmp = String(valA).localeCompare(String(valB));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [inventoryData, search, serviceFilter, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronDown size={14} className="opacity-30" />;

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "nom", label: "Collaborateur" },
    { key: "service", label: "Service" },
    { key: "type", label: "Type" },
    { key: "asset", label: "Asset", className: "font-mono" },
    { key: "sn", label: "N° Série", className: "font-mono" },
    { key: "dns", label: "DNS", className: "font-mono text-xs" },
    { key: "windows_version", label: "Windows" },
  ];

  return (
    <>
      <AbcroisiereImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <MultiDeviceModal open={multiDeviceOpen} onClose={() => setMultiDeviceOpen(false)} data={inventoryData} />
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Inventaire détaillé</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none">
              {services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none">
              <option value="Tous">Tous types</option>
              <option value="portable">Portable</option>
              <option value="Pc Fixe">PC Fixe</option>
            </select>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {isLoading ? "…" : `${filtered.length} résultats`}
            </span>
            <button onClick={() => exportToCSV(filtered)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground">
              <FileSpreadsheet size={13} />CSV
            </button>
            <button onClick={() => exportToPDF(filtered)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground">
              <FileText size={13} />PDF
            </button>
            <button onClick={() => setMultiDeviceOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Users size={13} />Multi-devices
            </button>
            <button onClick={() => setImportOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
              <Upload size={13} />Importer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Chargement de l'inventaire…</div>
          ) : inventoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Aucun équipement dans l'inventaire</p>
                <p className="mt-1 text-xs text-muted-foreground">Cliquez sur « Importer » pour charger votre fichier Excel.</p>
              </div>
              <button onClick={() => setImportOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                <Upload size={14} />Importer mon fichier
              </button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {columns.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="cursor-pointer whitespace-nowrap px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                      <span className="inline-flex items-center gap-1">{col.label}<SortIcon col={col.key} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((item, idx) => (
                  <tr key={`${item.asset}-${idx}`} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{item.nom}</span>
                        {item.absence && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            <AlertCircle size={10} />Absent
                          </span>
                        )}
                      </div>
                      {item.uid && <span className="text-[10px] text-muted-foreground">@{item.uid}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{item.service}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {item.type === "portable" ? <Laptop size={13} /> : <Monitor size={13} />}
                        {item.type === "portable" ? "Portable" : "PC Fixe"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{item.asset}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">{item.sn || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{item.dns || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {item.windows_version ? (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          item.windows_version.includes("11") ? "bg-primary/10 text-primary" : item.windows_version.includes("10") ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {item.windows_version.replace("Microsoft ", "").replace(" Professionnel", " Pro")}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && filtered.length > 50 && (
            <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
              Affichage de 50 sur {filtered.length} résultats. Utilisez les filtres pour affiner.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AbcroisiereInventoryTable;
