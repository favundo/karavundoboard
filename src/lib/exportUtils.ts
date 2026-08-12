import { type InventoryItem } from "@/data/inventoryData";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const exportToCSV = (data: InventoryItem[], filename = "inventaire") => {
  const headers = ["Nom", "Service", "Type", "Asset", "N° Série", "DNS", "UID", "Matricule", "Windows", "App. ESET", "Absent", "Fin de garantie", "Durée garantie (ans)"];
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
    item.eset_app || "",
    item.absence ? "Oui" : "Non",
    item.warranty_end_date ? new Date(item.warranty_end_date).toLocaleDateString("fr-FR") : "",
    item.warranty_duration != null ? String(item.warranty_duration) : "",
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

  const headers = [["Nom", "Service", "Type", "Asset", "N° Série", "DNS", "Windows", "App. ESET", "Fin de garantie", "Durée (ans)"]];
  const rows = data.map((item) => [
    item.nom,
    item.service,
    item.type === "portable" ? "Portable" : "PC Fixe",
    item.asset,
    item.sn || "—",
    item.dns || "—",
    item.windows_version || "—",
    item.eset_app || "—",
    item.warranty_end_date ? new Date(item.warranty_end_date).toLocaleDateString("fr-FR") : "—",
    item.warranty_duration != null ? String(item.warranty_duration) : "—",
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

// --- Agency exports ---

interface AgencyExportItem {
  agence: string;
  type: string;
  asset: string;
  sn: string;
  os_version: string;
  eset_app?: string;
}

export const exportAgencyToCSV = (data: AgencyExportItem[], filename = "inventaire_agences") => {
  const headers = ["Agence", "Type", "Asset", "N° Série", "Version OS", "App. ESET"];
  const rows = data.map((item) => [
    item.agence,
    item.type || "",
    item.asset || "",
    item.sn || "",
    item.os_version || "",
    item.eset_app || "",
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

export const exportAgencyToPDF = (data: AgencyExportItem[], filename = "inventaire_agences") => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Inventaire Réseau Agences — Karavel", 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} — ${data.length} équipements`, 14, 22);

  const headers = [["Agence", "Type", "Asset", "N° Série", "Version OS", "App. ESET"]];
  const rows = data.map((item) => [
    item.agence,
    item.type || "—",
    item.asset || "—",
    item.sn || "—",
    item.os_version || "—",
    item.eset_app || "—",
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

// --- Printer exports ---

interface PrinterExportItem {
  asset: string;
  modele: string;
  fabricant: string;
  ip: string;
  mac: string;
  hostname: string;
  sn: string;
  service: string;
  emplacement: string;
  date_enregistrement: string | null;
  warranty_duration: number | null;
}

const PRINTER_HEADERS = [
  "Asset", "Modèle", "Fabricant", "Adresse IP", "Adresse MAC", "Nom d'hôte",
  "N° Série", "Service", "Emplacement", "Date d'enregistrement", "Durée garantie (ans)",
];

const printerRow = (p: PrinterExportItem, empty: string) => [
  p.asset || empty,
  p.modele || empty,
  p.fabricant || empty,
  p.ip || empty,
  p.mac || empty,
  p.hostname || empty,
  p.sn || empty,
  p.service || empty,
  p.emplacement || empty,
  p.date_enregistrement ? new Date(p.date_enregistrement).toLocaleDateString("fr-FR") : empty,
  p.warranty_duration != null ? String(p.warranty_duration) : empty,
];

// Vrai fichier .xlsx (et non un CSV) : il peut être ré-importé tel quel via la modale d'import.
export const exportPrintersToExcel = (data: PrinterExportItem[], filename = "inventaire_imprimantes") => {
  const rows = data.map((p) => printerRow(p, ""));
  const sheet = XLSX.utils.aoa_to_sheet([PRINTER_HEADERS, ...rows]);
  sheet["!cols"] = PRINTER_HEADERS.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2,
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Imprimantes");
  XLSX.writeFile(book, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportPrintersToPDF = (data: PrinterExportItem[], filename = "inventaire_imprimantes") => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Inventaire Imprimantes Siège — Karavel", 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} — ${data.length} imprimantes`, 14, 22);

  autoTable(doc, {
    head: [PRINTER_HEADERS],
    body: data.map((p) => printerRow(p, "—")),
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
