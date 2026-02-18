import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Upload, Network } from "lucide-react";
import { useAgencyInventory, type AgencyItem } from "@/hooks/useAgencyInventory";
import AgencyImportModal from "./AgencyImportModal";

type SortKey = keyof AgencyItem;

const AgencyTable = () => {
  const { data, isLoading } = useAgencyInventory();
  const items: AgencyItem[] = data ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [agenceFilter, setAgenceFilter] = useState("Toutes");
  const [sortKey, setSortKey] = useState<SortKey>("agence");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const agences = useMemo(
    () => ["Toutes", ...Array.from(new Set(items.map((i) => i.agence))).sort()],
    [items]
  );

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        const s = search.toLowerCase();
        const matchSearch =
          !search ||
          item.agence.toLowerCase().includes(s) ||
          item.asset.toLowerCase().includes(s) ||
          item.sn.toLowerCase().includes(s) ||
          item.sous_reseau.toLowerCase().includes(s);
        const matchAgence = agenceFilter === "Toutes" || item.agence === agenceFilter;
        return matchSearch && matchAgence;
      })
      .sort((a, b) => {
        const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [items, search, agenceFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      : <ChevronDown size={14} className="opacity-30" />;

  const columns: { key: SortKey; label: string }[] = [
    { key: "agence", label: "Agence" },
    { key: "sous_reseau", label: "Sous-réseau" },
    { key: "masque", label: "Masque" },
    { key: "asset", label: "Asset" },
    { key: "sn", label: "N° Série" },
  ];

  return (
    <>
      <AgencyImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Inventaire réseau agences
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-lg border border-border bg-secondary pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <select
              value={agenceFilter}
              onChange={(e) => setAgenceFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {agences.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {isLoading ? "…" : `${filtered.length} résultats`}
            </span>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Upload size={13} />
              Importer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Chargement de l'inventaire réseau…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Network size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Aucun équipement dans l'inventaire réseau</p>
                <p className="mt-1 text-xs text-muted-foreground">Cliquez sur « Importer » pour charger votre fichier Excel.</p>
              </div>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Upload size={14} />
                Importer mon fichier
              </button>
            </div>
          ) : (
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
                  <tr key={`${item.asset}-${idx}`} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{item.agence}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">{item.sous_reseau || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {item.masque ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-primary">
                          /{item.masque}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{item.asset || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">{item.sn || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && filtered.length > 100 && (
            <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
              Affichage de 100 sur {filtered.length} résultats. Utilisez les filtres pour affiner.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AgencyTable;
