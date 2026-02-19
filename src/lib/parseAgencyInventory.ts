import * as XLSX from "xlsx";
import { type AgencyItem } from "@/hooks/useAgencyInventory";

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_MAP: Record<string, keyof AgencyItem> = {
  // sous_reseau
  "sousrseaumasque": "sous_reseau",
  "sousreseau": "sous_reseau",
  "reseau": "sous_reseau",
  "subnet": "sous_reseau",
  "network": "sous_reseau",
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
};

export type AgencyParseResult = {
  items: AgencyItem[];
  errors: string[];
  warnings: string[];
};

const parseSubnetMask = (raw: string): { sous_reseau: string; masque: string } => {
  const trimmed = raw.trim();
  const parts = trimmed.split("/");
  if (parts.length === 2) {
    return { sous_reseau: parts[0].trim(), masque: parts[1].trim() };
  }
  return { sous_reseau: trimmed, masque: "" };
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
          // Check exact match or partial match for subnet column
          if (COLUMN_MAP[norm]) {
            mapping[h] = COLUMN_MAP[norm];
          } else {
            // Partial match for combined "Sous-réseau / Masque" style columns
            const normPartial = norm.replace(/masque|mask/, "");
            if (normPartial.includes("sousreseau") || normPartial.includes("sousrse") || normPartial.includes("subnet")) {
              mapping[h] = "sous_reseau";
            }
          }
        }

        const items: AgencyItem[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const row of rows) {
          const item: AgencyItem = {
            sous_reseau: "",
            masque: "",
            agence: "",
            asset: "",
            sn: "",
            os_version: "",
          };

          for (const [col, field] of Object.entries(mapping)) {
            const val = String(row[col] ?? "").trim();
            if (field === "sous_reseau") {
              const parsed = parseSubnetMask(val);
              item.sous_reseau = parsed.sous_reseau;
              item.masque = parsed.masque;
            } else {
              (item as unknown as Record<string, unknown>)[field] = val;
            }
          }

          // Clean agence name: remove "Agence_" prefix
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
