import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Laptop, Monitor, AlertCircle, Handshake, FileText, FileSpreadsheet } from "lucide-react";
import { type InventoryItem } from "@/data/inventoryData";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useStockInventory } from "@/hooks/useStockInventory";

type SortKey = keyof InventoryItem;

const StockInventoryTable = () => {
  const { data: inventoryFromDb, isLoading } = useStockInventory();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [osFilter, setOsFilter] = useState("Tous");
  const [sortKey, setSortKey] = useState<SortKey>("asset");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const inventoryData: InventoryItem[] = inventoryFromDb ?? [];

  const osVersions = useMemo(
    () => ["Tous", ...Array.from(new Set(inventoryData.map((i) => i.windows_version ?? "").filter(Boolean))).sort()],
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
          item.sn.toLowerCase().includes(search.toLowerCase()) ||
          item.dns.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === "Tous" || item.type === typeFilter;
        const matchOs = osFilter === "Tous" || (item.windows_version ?? "") === osFilter;
        return matchSearch && matchType && matchOs;
      })
      .sort((a, b) => {
        const valA = a[sortKey] ?? "";
        const valB = b[sortKey] ?? "";
        const cmp = String(valA).localeCompare(String(valB));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [inventoryData, search, typeFilter, osFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
    ) : (
      <ChevronDown size={14} className="opacity-30" />
    );

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "asset", label: "Asset", className: "font-mono" },
    { key: "type", label: "Type" },
    { key: "nom", label: "Affecté à" },
    { key: "sn", label: "N° Série", className: "font-mono" },
    { key: "dns", label: "DNS", className: "font-mono text-xs" },
    { key: "windows_version", label: "Windows" },
  ];

  const hasFilter = search !== "" || typeFilter !== "Tous" || osFilter !== "Tous";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap mr-1">
          Recherche rapide
        </span>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Asset, N° série, DNS, nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          <option value="Tous">Tous types</option>
          <option value="portable">Portable</option>
          <option value="Pc Fixe">PC Fixe</option>
        </select>
        <select
          value={osFilter}
          onChange={(e) => setOsFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          {osVersions.map((v) => (
            <option key={v} value={v}>{v === "Tous" ? "Toutes versions" : v}</option>
          ))}
        </select>
        {hasFilter && (
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary whitespace-nowrap">
            {isLoading ? "…" : `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
          </span>
        )}
        <button
          onClick={() => exportToCSV(hasFilter ? filtered : inventoryData)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <FileSpreadsheet size={13} />
          CSV
        </button>
        <button
          onClick={() => exportToPDF(hasFilter ? filtered : inventoryData)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <FileText size={13} />
          PDF
        </button>
        {!isLoading && inventoryData.length > 0 && !hasFilter && (
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
            {inventoryData.length} équipement{inventoryData.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="overflow-x-auto border-t border-border">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : inventoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Aucun équipement en stock</p>
            <p className="text-xs text-muted-foreground">Utilisez le bouton "Stock" dans Siège pour déplacer des assets ici.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat pour cette recherche.
          </div>
        ) : (
          <>
            {filtered.length > 100 && (
              <div className="border-b border-border bg-amber-50/60 dark:bg-amber-900/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
                Affichage limité à 100 sur {filtered.length} résultats — affinez les filtres pour voir plus.
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((item, idx) => (
                  <tr
                    key={`${item.asset}-${idx}`}
                    className="border-b border-border/50 transition-colors hover:bg-muted/20"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{item.asset}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {item.type === "portable" ? <Laptop size={13} /> : <Monitor size={13} />}
                        {item.type === "portable" ? "Portable" : "PC Fixe"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {item.nom ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{item.nom}</span>
                            {item.absence && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                <AlertCircle size={10} />
                                Absent
                              </span>
                            )}
                            {item.pret && (
                              <span
                                title={item.pret_utilisateur ? `Emprunté par ${item.pret_utilisateur}` : undefined}
                                className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 cursor-default"
                              >
                                <Handshake size={10} />
                                En prêt
                              </span>
                            )}
                          </div>
                          {item.uid && <span className="text-[10px] text-muted-foreground">@{item.uid}</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">Disponible</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">{item.sn || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {item.dns || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {item.windows_version ? (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          item.windows_version.includes("11")
                            ? "bg-primary/10 text-primary"
                            : item.windows_version.includes("10")
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {item.windows_version.replace("Microsoft ", "").replace(" Professionnel", " Pro")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default StockInventoryTable;
