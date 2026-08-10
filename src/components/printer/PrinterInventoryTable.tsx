import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { usePrinterInventory, isWarrantyExpired, type PrinterItem } from "@/hooks/usePrinterInventory";

type SortKey = keyof PrinterItem;

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

const PrinterInventoryTable = () => {
  const { data, isLoading } = usePrinterInventory();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("asset");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const printers = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return printers
      .filter((p) => {
        if (!q) return true;
        // Recherche sur l'ensemble des champs
        return [
          p.asset, p.modele, p.mac, p.ip, p.fabricant, p.hostname,
          p.sn, p.service, p.emplacement, p.date_enregistrement ?? "",
          p.warranty_duration != null ? String(p.warranty_duration) : "",
        ].some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const valA = a[sortKey] ?? "";
        const valB = b[sortKey] ?? "";
        const cmp = String(valA).localeCompare(String(valB), "fr", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [printers, search, sortKey, sortDir]);

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
    { key: "modele", label: "Modèle" },
    { key: "ip", label: "Adresse IP", className: "font-mono text-xs" },
    { key: "sn", label: "N° Série", className: "font-mono text-xs" },
    { key: "service", label: "Service" },
    { key: "date_enregistrement", label: "Date d'enregistrement" },
    { key: "warranty_duration", label: "Durée garantie (ans)" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar : recherche rapide */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap mr-1">
          Recherche rapide
        </span>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Asset, modèle, IP, N° série, service, hôte, MAC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
          {isLoading ? "…" : `${filtered.length} imprimante${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-t border-border">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : printers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Printer size={24} />
            </div>
            <p className="text-sm font-medium text-foreground">Aucune imprimante dans l'inventaire</p>
            <p className="text-xs text-muted-foreground">Cliquez sur « Ajouter » pour enregistrer une imprimante.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat pour cette recherche.
          </div>
        ) : (
          <table className="min-w-full text-xs">
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
              {filtered.map((p) => {
                const expired = isWarrantyExpired(p.date_enregistrement, p.warranty_duration);
                return (
                  <tr key={p.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{p.asset}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{p.modele || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.ip || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sn || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        {p.service || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(p.date_enregistrement)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {p.warranty_duration != null ? (
                        <span
                          className={
                            expired
                              ? "inline-flex items-center rounded-md bg-destructive/15 px-2 py-0.5 font-semibold text-destructive"
                              : "text-muted-foreground"
                          }
                          title={expired ? "Garantie dépassée" : undefined}
                        >
                          {p.warranty_duration} ans
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PrinterInventoryTable;
