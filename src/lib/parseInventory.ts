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
  "departement": "service",
  "department": "service",
  "département": "service",
  // type
  "type": "type",
  "type équipement": "type",
  "type equipement": "type",
  "type_immo": "type",
  "type-immo": "type",
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
  "nom de l'ordinateur": "dns",
  "nom de l ordinateur": "dns",
  "nom ordinateur": "dns",
  "nom machine": "dns",
  "nom poste": "dns",
  "nom du poste": "dns",
  "nom du pc": "dns",
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
  // eset_app
  "eset_app": "eset_app",
  "eset": "eset_app",
  "application eset": "eset_app",
  "app eset": "eset_app",
  "securite eset": "eset_app",
  "application de securite": "eset_app",
  "application securite": "eset_app",
  "antivirus": "eset_app",
  // windows_version
  "windows_version": "windows_version",
  "version de windows": "windows_version",
  "version windows": "windows_version",
  "os": "windows_version",
  "os version": "windows_version",
  "version os": "windows_version",
  "windows": "windows_version",
  "version": "windows_version",
  "systeme exploitation": "windows_version",
  "systeme d'exploitation": "windows_version",
  "systeme d exploitation": "windows_version",
  // warranty_end_date
  "warranty_end_date": "warranty_end_date",
  "date fin de garantie": "warranty_end_date",
  "fin de garantie": "warranty_end_date",
  "fin garantie": "warranty_end_date",
  "date garantie": "warranty_end_date",
  "date fin garantie": "warranty_end_date",
  "expiration garantie": "warranty_end_date",
  "expiration de garantie": "warranty_end_date",
  "warranty end date": "warranty_end_date",
  "warranty end": "warranty_end_date",
  // warranty_duration
  "warranty_duration": "warranty_duration",
  "duree garantie": "warranty_duration",
  "duree de la garantie": "warranty_duration",
  "duree de garantie": "warranty_duration",
  "warranty duration": "warranty_duration",
  "garantie mois": "warranty_duration",
  "garantie (mois)": "warranty_duration",
  "duree (mois)": "warranty_duration",
  "garantie ans": "warranty_duration",
  "garantie (ans)": "warranty_duration",
  "duree (ans)": "warranty_duration",
  "duree garantie ans": "warranty_duration",
};

export type ParseResult = {
  items: InventoryItem[];
  errors: string[];
  warnings: string[];
  columnMapping: Record<string, string>;
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

const normalizeType = (val: string): "portable" | "Pc Fixe" => {
  const v = val.trim().toLowerCase();
  // "uc" doit être un mot entier (début ou après espace/tiret) pour éviter les faux positifs
  const isUC = /(?:^|[\s\-_])uc(?:$|[\s\-_\d])/.test(v) || v === "uc";
  if (v.includes("fixe") || v.includes("desktop") || isUC) return "Pc Fixe";
  return "portable";
};

// Converts DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD or any JS-parseable date → "YYYY-MM-DD" (or "" if unparseable)
const normalizeDate = (val: string): string => {
  const s = val.trim();
  if (!s) return "";
  // DD/MM/YYYY or D/M/YYYY — validate ranges to reject Excel epoch artefacts like "01/00/1900"
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const dNum = Number(d), mNum = Number(m), yNum = Number(y);
    if (yNum > 1900 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const date = new Date(yNum, mNum - 1, dNum);
      if (!isNaN(date.getTime())) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return "";
  }
  // Already ISO YYYY-MM-DD — validate month/day to reject Excel epoch artefacts like "1900-00-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return s;
    return "";
  }
  // Fallback: try JS Date parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
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
          } else {
            // Fallback: try "contains" matching for unrecognized headers
            // Sort by key length descending so longer keys (e.g. "nom dns") match before shorter ones (e.g. "nom")
            const match = Object.entries(COLUMN_MAP).sort((a, b) => b[0].length - a[0].length).find(([key]) => norm.includes(key) || key.includes(norm));
            if (match) {
              mapping[h] = match[1];
              columnMapping[h] = match[1];
            }
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

        // Warn if windows_version not detected
        if (!mappedFields.has("windows_version")) {
          warnings.push("Colonne 'Version Windows' non détectée — vérifiez le nom de la colonne dans votre fichier.");
          console.warn("[parseInventory] Headers found:", headers, "Mapping:", mapping);
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
            eset_app: "",
          };

          for (const [col, field] of Object.entries(mapping)) {
            const val = String(row[col] ?? "");
            if (field === "type") {
              item.type = normalizeType(val);
            } else if (field === "absence") {
              item.absence = normalizeBoolean(row[col]);
            } else if (field === "warranty_end_date") {
              item.warranty_end_date = normalizeDate(val) || undefined;
            } else if (field === "warranty_duration") {
              const n = parseInt(val, 10);
              item.warranty_duration = isNaN(n) ? undefined : n;
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
