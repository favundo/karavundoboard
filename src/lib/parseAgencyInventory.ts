import * as XLSX from "xlsx";
import { type AgencyItem } from "@/hooks/useAgencyInventory";

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_MAP: Record<string, keyof AgencyItem> = {
  // agence
  "agence": "agence",
  "agency": "agence",
  "site": "agence",
  // asset
  "asset": "asset",
  "nasset": "asset",
  "assettag": "asset",
  // sn
  "sn": "sn",
  "nsrie": "sn",
  "serial": "sn",
  "numerodesr": "sn",
  "noserie": "sn",
  // os_version
  "os": "os_version",
  "osversion": "os_version",
  "versionos": "os_version",
  "systemeexploitation": "os_version",
  "os_version": "os_version",
  "windowsversion": "os_version",
  "versionwindows": "os_version",
  "version": "os_version",
  // type
  "type": "type",
  "typeposte": "type",
  "typeequipement": "type",
  "typemateriel": "type",
  // eset_app
  "esetapp": "eset_app",
  "eset": "eset_app",
  "applicationeset": "eset_app",
  "appeset": "eset_app",
  "antivirus": "eset_app",
  "securiteeset": "eset_app",
  "applicationdesecuriteeset": "eset_app",
  "applicationdesecuriteset": "eset_app",
  "appdesecuriteeset": "eset_app",
};

export type AgencyParseResult = {
  items: AgencyItem[];
  errors: string[];
  warnings: string[];
};

export const parseAgencyFile = async (file: File): Promise<AgencyParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });

        if (rows.length === 0) {
          resolve({ items: [], errors: ["Le fichier est vide ou illisible."], warnings: [] });
          return;
        }

        const headers = Object.keys(rows[0]);
        const mapping: Record<string, keyof AgencyItem> = {};

        for (const h of headers) {
          const norm = normalizeHeader(h);
          if (COLUMN_MAP[norm]) {
            mapping[h] = COLUMN_MAP[norm];
          }
        }

        const items: AgencyItem[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const row of rows) {
          const item: AgencyItem = {
            agence: "",
            asset: "",
            sn: "",
            os_version: "",
            type: "",
            eset_app: "",
          };

          for (const [col, field] of Object.entries(mapping)) {
            (item as unknown as Record<string, unknown>)[field] = String(row[col] ?? "").trim();
          }

          // Clean agence name: remove "Agence_" or "Agence " prefix
          if (item.agence.startsWith("Agence_")) {
            item.agence = item.agence.replace("Agence_", "").replace(/_/g, " ");
          } else if (item.agence.startsWith("Agence ")) {
            item.agence = item.agence.replace("Agence ", "").replace(/_/g, " ");
          }

          if (!item.agence && !item.asset) continue;

          items.push(item);
        }

        if (items.length === 0) {
          errors.push("Aucune ligne valide trouvée dans le fichier.");
        }

        resolve({ items, errors, warnings });
      } catch (err) {
        resolve({
          items: [],
          errors: [`Erreur de lecture du fichier : ${String(err)}`],
          warnings: [],
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
};
