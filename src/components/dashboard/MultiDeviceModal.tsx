import { useMemo } from "react";
import { Users, FileSpreadsheet, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type InventoryItem } from "@/data/inventoryData";
import { exportMultiDeviceToCSV, exportMultiDeviceToPDF } from "@/lib/exportUtils";

interface MultiDeviceModalProps {
  open: boolean;
  onClose: () => void;
  data: InventoryItem[];
}

interface MultiDeviceGroup {
  uid: string;
  nom: string;
  service: string;
  devices: { asset: string; type: string; windows_version?: string }[];
}

const MultiDeviceModal = ({ open, onClose, data }: MultiDeviceModalProps) => {
  const groups = useMemo<MultiDeviceGroup[]>(() => {
    const counts = new Map<string, InventoryItem[]>();
    data.forEach((item) => {
      if (!item.uid) return;
      const existing = counts.get(item.uid) ?? [];
      existing.push(item);
      counts.set(item.uid, existing);
    });
    return Array.from(counts.entries())
      .filter(([, items]) => items.length > 1)
      .map(([uid, items]) => ({
        uid,
        nom: items[0].nom,
        service: items[0].service,
        devices: items.map((i) => ({
          asset: i.asset,
          type: i.type === "portable" ? "Portable" : "PC Fixe",
          windows_version: i.windows_version,
        })),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} />
            Collaborateurs multi-devices
          </DialogTitle>
          <DialogDescription>
            {groups.length} collaborateur{groups.length > 1 ? "s" : ""} possédant plusieurs équipements
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <button
            onClick={() => exportMultiDeviceToCSV(groups)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FileSpreadsheet size={13} />CSV
          </button>
          <button
            onClick={() => exportMultiDeviceToPDF(groups)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FileText size={13} />PDF
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Collaborateur</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">UID</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Service</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Asset</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Windows</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.devices.map((device, idx) => (
                  <tr
                    key={`${group.uid}-${idx}`}
                    className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${idx === 0 ? "border-t border-border" : ""}`}
                  >
                    {idx === 0 ? (
                      <>
                        <td rowSpan={group.devices.length} className="px-3 py-2 font-medium text-foreground align-top">
                          {group.nom}
                        </td>
                        <td rowSpan={group.devices.length} className="px-3 py-2 font-mono text-muted-foreground align-top">
                          {group.uid}
                        </td>
                        <td rowSpan={group.devices.length} className="px-3 py-2 align-top">
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                            {group.service}
                          </span>
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2 font-mono text-primary">{device.asset}</td>
                    <td className="px-3 py-2 text-muted-foreground">{device.type}</td>
                    <td className="px-3 py-2">
                      {device.windows_version ? (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          device.windows_version.includes("11") ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                        }`}>
                          {device.windows_version.replace("Microsoft ", "").replace(" Professionnel", " Pro")}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MultiDeviceModal;
