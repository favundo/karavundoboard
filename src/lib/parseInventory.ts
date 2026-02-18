import * as XLSX from "xlsx";
import { type InventoryItem } from "@/data/inventoryData";

// Column aliases: maps various header spellings → canonical field name
const COLUMN_MAP: Record<string, keyof InventoryItem> = {
  // nom
  "nom": "nom",
  "nom complet": "nom",
  "collaborateur": "nom",
  "name": "nom",
  // uid
  "uid": "uid",
  "identifiant": "uid",
  "login": "uid",
  // service
  "service": "service",
  "département": "service",
  "departement": "service",
  "department": "service",
  // type
  "type": "type",
  "type équipement": "type",
  "type equipement": "type",
  "type_immo": "type",
  "typeimmo": "type",
  // asset
  "asset": "asset",
  "n° asset": "asset",
  "no asset": "asset",
  "asset tag": "asset",
  "n°asset": "asset",
  // sn
  "sn": "sn",
  "n° série": "sn",
  "no série": "sn",
  "serial": "sn",
  "numéro de série": "sn",
  "no serie": "sn",
  "n° serie": "sn",
  // dns
  "dns": "dns",
  "hostname": "dns",
  "nom dns": "dns",
  "nomdns": "dns",
  // absence
  "absence": "absence",
  "absent": "absence",
  "en absence": "absence",
  // matricule
  "matricule": "matricule",
  "n° matricule": "matricule",
  "no matricule": "matricule",
  // pseudo
  "pseudo": "pseudo",
  "surnom": "pseudo",
  // remarques
  "remarques": "remarques",
  "remarque": "remarques",
  "commentaire": "remarques",
  "commentaires": "remarques",
  "notes": "remarques",
  // windows_version
  "windows_version": "windows_version",
  "version de windows": "windows_version",
  "version windows": "windows_version",
  "os": "windows_version",
};

export type ParseResult = {
  items: InventoryItem[];
  errors: string[];
  warnings: string[];
  columnMapping: Record<string, string>;
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeType = (val: string): "portable" | "Pc Fixe" => {
  const v = val.trim().toLowerCase();
  if (v.includes("fixe") || v.includes("desktop") || v.includes("uc")) return "Pc Fixe";
  return "portable";
};

const normalizeBoolean = (val: unknown): boolean => {
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  return ["oui", "yes", "true", "1", "x"].includes(s);
};

export const parseFile = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Try to find the right sheet: prefer "liste pc en prod et salariés" or first sheet
        const sheetName =
          workbook.SheetNames.find((n) =>
            n.toLowerCase().includes("prod") || n.toLowerCase().includes("liste")
          ) ?? workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });

        if (rows.length === 0) {
          resolve({ items: [], errors: ["Le fichier est vide ou illisible."], warnings: [], columnMapping: {} });
          return;
        }

        // Build column mapping from actual headers
        const headers = Object.keys(rows[0]);
        const mapping: Record<string, keyof InventoryItem> = {};
        const columnMapping: Record<string, string> = {};

        for (const h of headers) {
          const norm = normalizeHeader(h);
          if (COLUMN_MAP[norm]) {
            mapping[h] = COLUMN_MAP[norm];
            columnMapping[h] = COLUMN_MAP[norm];
          }
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        // Check required columns
        const mappedFields = new Set(Object.values(mapping));
        const required: (keyof InventoryItem)[] = ["nom", "service"];
        const missing = required.filter((f) => !mappedFields.has(f));
        if (missing.length > 0) {
          errors.push(`Colonnes requises manquantes : ${missing.join(", ")}`);
          resolve({ items: [], errors, warnings, columnMapping });
          return;
        }

        const items: InventoryItem[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const item: InventoryItem = {
            nom: "",
            uid: "",
            service: "",
            type: "portable",
            asset: "",
            sn: "",
            dns: "",
            absence: false,
            matricule: "",
            pseudo: "",
            remarques: "",
            windows_version: "",
          };

          for (const [col, field] of Object.entries(mapping)) {
            const val = String(row[col] ?? "");
            if (field === "type") {
              item.type = normalizeType(val);
            } else if (field === "absence") {
              item.absence = normalizeBoolean(row[col]);
            } else {
              (item as unknown as Record<string, unknown>)[field] = val.trim();
            }
          }

          // Skip truly empty rows (no name AND no asset)
          if (!item.nom && !item.asset) continue;

          items.push(item);
        }

        if (items.length === 0) {
          errors.push("Aucune ligne valide trouvée dans le fichier.");
        }

        resolve({ items, errors, warnings, columnMapping });
      } catch (err) {
        resolve({
          items: [],
          errors: [`Erreur de lecture du fichier : ${String(err)}`],
          warnings: [],
          columnMapping: {},
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
};
