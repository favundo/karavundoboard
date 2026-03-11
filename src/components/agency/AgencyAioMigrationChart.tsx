import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";
import { List, FileSpreadsheet, FileText, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TypeStatus = "Full AIO" | "Full Tour" | "Mixte";

const STATUS_COLORS: Record<TypeStatus, string> = {
  "Full AIO": "hsl(var(--chart-1))",
  "Full Tour": "hsl(var(--chart-2))",
  "Mixte": "hsl(var(--chart-4))",
};

const CustomTooltip = ({ active, payload, totalAgencies }: { active?: boolean; payload?: any[]; totalAgencies: number }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const pct = totalAgencies > 0 ? ((value / totalAgencies) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">{value} agence{value > 1 ? "s" : ""} ({pct}%)</p>
    </div>
  );
};

type AgencyDetail = { agence: string; status: TypeStatus; types: string[]; assets: string[] };

const exportDetailCSV = (list: AgencyDetail[]) => {
  const headers = ["Agence", "Statut", "Assets", "Types"];
  const rows = list.map((a) => [a.agence, a.status, a.assets.join(", "), a.types.join(", ")]);
  const BOM = "\uFEFF";
  const csv = BOM + [headers.join(";"), ...rows.map((r) => r.map((c) => `"${c}"`).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agences_non_full_aio_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportDetailPDF = (list: AgencyDetail[]) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Agences non Full AIO", 14, 18);
  doc.setFontSize(9);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [["Agence", "Statut", "Assets", "Types"]],
    body: list.map((a) => [a.agence, a.status, a.assets.join(", "), a.types.join(", ")]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`agences_non_full_aio_${new Date().toISOString().slice(0, 10)}.pdf`);
};

const normalizeType = (v: string): "aio" | "tour" | "other" => {
  if (!v) return "other";
  const l = v.toLowerCase().trim();
  if (l === "aio") return "aio";
  if (l === "tour") return "tour";
  return "other";
};

const AgencyAioMigrationChart = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];
  const [showDetail, setShowDetail] = useState(false);

  const { chartData, totalAgencies, nonFullAioAgencies } = useMemo(() => {
    const agencyTypes: Record<string, Set<string>> = {};
    const agencyRawTypes: Record<string, Set<string>> = {};
    const agencyAssetList: Record<string, Set<string>> = {};

    for (const item of items) {
      if (!item.agence) continue;
      if (!agencyTypes[item.agence]) {
        agencyTypes[item.agence] = new Set();
        agencyRawTypes[item.agence] = new Set();
        agencyAssetList[item.agence] = new Set();
      }
      agencyTypes[item.agence].add(normalizeType(item.type ?? ""));
      if (item.type) agencyRawTypes[item.agence].add(item.type);
      if (item.asset && !item.asset.startsWith("EMPTY-")) agencyAssetList[item.agence].add(item.asset);
    }

    let fullAio = 0;
    let fullTour = 0;
    let mixte = 0;
    const nonFullAio: AgencyDetail[] = [];

    for (const [agence, types] of Object.entries(agencyTypes)) {
      const hasAio = types.has("aio");
      const hasTour = types.has("tour");
      const hasOther = types.has("other");
      const assets = Array.from(agencyAssetList[agence] || []);
      const rawTypes = Array.from(agencyRawTypes[agence] || []);

      if (hasAio && !hasTour && !hasOther) {
        fullAio++;
      } else if (hasTour && !hasAio && !hasOther) {
        fullTour++;
        nonFullAio.push({ agence, status: "Full Tour", types: rawTypes, assets });
      } else {
        mixte++;
        nonFullAio.push({ agence, status: "Mixte", types: rawTypes, assets });
      }
    }

    nonFullAio.sort((a, b) => a.agence.localeCompare(b.agence));

    return {
      chartData: [
        { name: "Full AIO" as TypeStatus, value: fullAio },
        { name: "Full Tour" as TypeStatus, value: fullTour },
        { name: "Mixte" as TypeStatus, value: mixte },
      ],
      totalAgencies: Object.keys(agencyTypes).length,
      nonFullAioAgencies: nonFullAio,
    };
  }, [items]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 h-full flex flex-col">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Migration AIO parc agence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "…" : `${totalAgencies} agences`}
          </p>
        </div>
        {!isLoading && nonFullAioAgencies.length > 0 && (
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Voir les agences non Full AIO"
          >
            <List size={12} />
            <span className="hidden sm:inline">{showDetail ? "Masquer" : "Détail"}</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Chargement…</div>
      ) : totalAgencies === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Aucune donnée</div>
      ) : (
        <>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip totalAgencies={totalAgencies} />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                  ))}
                  <LabelList dataKey="value" position="inside" fill="#fff" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {showDetail && (
            <div className="mt-3 border-t border-border pt-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">
                  Agences non Full AIO ({nonFullAioAgencies.length})
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportDetailCSV(nonFullAioAgencies)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <FileSpreadsheet size={11} /> CSV
                  </button>
                  <button
                    onClick={() => exportDetailPDF(nonFullAioAgencies)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <FileText size={11} /> PDF
                  </button>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="inline-flex items-center justify-center rounded-md h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {nonFullAioAgencies.map((a) => (
                  <div key={a.agence} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1 text-[11px]">
                    <span className="font-medium text-foreground">{a.agence}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      a.status === "Full Tour"
                        ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgencyAioMigrationChart;
