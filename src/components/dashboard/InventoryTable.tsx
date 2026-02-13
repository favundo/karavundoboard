import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Laptop, Monitor, AlertCircle } from "lucide-react";
import { inventoryData, type InventoryItem } from "@/data/inventoryData";

type SortKey = keyof InventoryItem;

const InventoryTable = () => {
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const services = useMemo(
    () => ["Tous", ...Array.from(new Set(inventoryData.map((i) => i.service))).sort()],
    []
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
  }, [search, serviceFilter, typeFilter, sortKey, sortDir]);

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
    { key: "nom", label: "Collaborateur" },
    { key: "service", label: "Service" },
    { key: "type", label: "Type" },
    { key: "asset", label: "Asset", className: "font-mono" },
    { key: "sn", label: "N° Série", className: "font-mono" },
    { key: "dns", label: "DNS", className: "font-mono text-xs" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Inventaire détaillé
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-lg border border-border bg-secondary pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="Tous">Tous types</option>
            <option value="portable">Portable</option>
            <option value="Pc Fixe">PC Fixe</option>
          </select>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {filtered.length} résultats
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
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
            {filtered.slice(0, 50).map((item, idx) => (
              <tr
                key={`${item.asset}-${idx}`}
                className="border-b border-border/50 transition-colors hover:bg-muted/20"
              >
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.nom}</span>
                    {item.absence && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        <AlertCircle size={10} />
                        Absent
                      </span>
                    )}
                  </div>
                  {item.uid && <span className="text-[10px] text-muted-foreground">@{item.uid}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {item.service}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {item.type === "portable" ? <Laptop size={13} /> : <Monitor size={13} />}
                    {item.type === "portable" ? "Portable" : "PC Fixe"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{item.asset}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">{item.sn || "—"}</td>
                <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                  {item.dns || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
            Affichage de 50 sur {filtered.length} résultats. Utilisez les filtres pour affiner.
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryTable;
