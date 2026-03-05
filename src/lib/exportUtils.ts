import { type InventoryItem } from "@/data/inventoryData";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToCSV = (data: InventoryItem[], filename = "inventaire") => {
  const headers = ["Nom", "Service", "Type", "Asset", "N° Série", "DNS", "UID", "Matricule", "Windows", "Absent"];
  const rows = data.map((item) => [
    item.nom,
    item.service,
    item.type === "portable" ? "Portable" : "PC Fixe",
    item.asset,
    item.sn || "",
    item.dns || "",
    item.uid,
    item.matricule,
    item.windows_version || "",
    item.absence ? "Oui" : "Non",
  ]);

  const BOM = "\uFEFF";
  const csvContent = BOM + [headers.join(";"), ...rows.map((r) => r.map((c) => `"${c}"`).join(";"))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = (data: InventoryItem[], filename = "inventaire") => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Inventaire Parc IT — Karavel", 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} — ${data.length} équipements`, 14, 22);

  const headers = [["Nom", "Service", "Type", "Asset", "N° Série", "DNS", "Windows"]];
  const rows = data.map((item) => [
    item.nom,
    item.service,
    item.type === "portable" ? "Portable" : "PC Fixe",
    item.asset,
    item.sn || "—",
    item.dns || "—",
    item.windows_version || "—",
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [20, 30, 45], textColor: [0, 210, 210], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// --- Multi-device exports ---

interface MultiDeviceGroup {
  uid: string;
  nom: string;
  service: string;
  devices: { asset: string; type: string; windows_version?: string }[];
}

export const exportMultiDeviceToCSV = (groups: MultiDeviceGroup[], filename = "multi-devices") => {
  const headers = ["Nom", "UID", "Service", "Asset", "Type", "Windows"];
  const rows: string[][] = [];
  groups.forEach((g) => {
    g.devices.forEach((d) => {
      rows.push([g.nom, g.uid, g.service, d.asset, d.type, d.windows_version || ""]);
    });
  });

  const BOM = "\uFEFF";
  const csvContent = BOM + [headers.join(";"), ...rows.map((r) => r.map((c) => `"${c}"`).join(";"))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMultiDeviceToPDF = (groups: MultiDeviceGroup[], filename = "multi-devices") => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Collaborateurs multi-devices — Karavel", 14, 15);

  const totalDevices = groups.reduce((sum, g) => sum + g.devices.length, 0);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} — ${groups.length} collaborateurs, ${totalDevices} équipements`, 14, 22);

  const headers = [["Nom", "UID", "Service", "Asset", "Type", "Windows"]];
  const rows: string[][] = [];
  groups.forEach((g) => {
    g.devices.forEach((d) => {
      rows.push([g.nom, g.uid, g.service, d.asset, d.type, d.windows_version?.replace("Microsoft ", "").replace(" Professionnel", " Pro") || "—"]);
    });
  });

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [20, 30, 45], textColor: [0, 210, 210], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
