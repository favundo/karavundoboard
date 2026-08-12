import * as XLSX from "xlsx";

export interface ParsedPrinter {
  asset: string;
  modele: string;
  mac: string;
  ip: string;
  fabricant: string;
  hostname: string;
  sn: string;
  service: string;
  emplacement: string;
  date_enregistrement: string | null;
  warranty_duration: number | null;
}

// Column aliases: maps various header spellings → canonical field name
const COLUMN_MAP: Record<string, keyof ParsedPrinter> = {
  // asset
  "asset": "asset",
  "n° asset": "asset",
  "no asset": "asset",
  "n°asset": "asset",
  "asset tag": "asset",
  "immo": "asset",
  // modele
  "modele": "modele",
  "modèle": "modele",
  "model": "modele",
  "type imprimante": "modele",
  // mac
  "mac": "mac",
  "adresse mac": "mac",
  "mac address": "mac",
  // ip
  "ip": "ip",
  "adresse ip": "ip",
  "ip address": "ip",
  // fabricant
  "fabricant": "fabricant",
  "constructeur": "fabricant",
  "marque": "fabricant",
  "manufacturer": "fabricant",
  // hostname
  "hostname": "hostname",
  "nom d'hote": "hostname",
  "nom d hote": "hostname",
  "nom hote": "hostname",
  "dns": "hostname",
  "nom dns": "hostname",
  // sn
  "sn": "sn",
  "n° série": "sn",
  "n° serie": "sn",
  "no serie": "sn",
  "numero de serie": "sn",
  "serial": "sn",
  "serial number": "sn",
  // service
  "service": "service",
  "departement": "service",
  "département": "service",
  // emplacement
  "emplacement": "emplacement",
  "localisation": "emplacement",
  "site": "emplacement",
  "lieu": "emplacement",
  "etage": "emplacement",
  // date_enregistrement
  "date enregistrement": "date_enregistrement",
  "date d'enregistrement": "date_enregistrement",
  "date d enregistrement": "date_enregistrement",
  "date": "date_enregistrement",
  "date achat": "date_enregistrement",
  "date d'achat": "date_enregistrement",
  "date de mise en service": "date_enregistrement",
  // warranty_duration
  "duree garantie": "warranty_duration",
  "duree de garantie": "warranty_duration",
  "duree garantie ans": "warranty_duration",
  "garantie ans": "warranty_duration",
  "garantie (ans)": "warranty_duration",
  "garantie": "warranty_duration",
  "warranty duration": "warranty_duration",
};

export type PrinterParseResult = {
  items: ParsedPrinter[];
  errors: string[];
  warnings: string[];
  columnMapping: Record<string, string>;
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

// Converts DD/MM/YYYY, YYYY-MM-DD or any JS-parseable date → "YYYY-MM-DD" (or "" if unparseable)
const normalizeDate = (val: string): string => {
  const s = val.trim();
  if (!s) return "";
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const dNum = Number(d), mNum = Number(m), yNum = Number(y);
    if (yNum > 1900 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return s;
    return "";
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
};

const EMPTY_PRINTER = (): ParsedPrinter => ({
  asset: "",
  modele: "",
  mac: "",
  ip: "",
  fabricant: "",
  hostname: "",
  sn: "",
  service: "",
  emplacement: "",
  date_enregistrement: null,
  warranty_duration: null,
});

export const parsePrinterFile = async (file: File): Promise<PrinterParseResult> => {
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
          resolve({ items: [], errors: ["Le fichier est vide ou illisible."], warnings: [], columnMapping: {} });
          return;
        }

        // Build column mapping from actual headers
        const headers = Object.keys(rows[0]);
        const mapping: Record<string, keyof ParsedPrinter> = {};
        const columnMapping: Record<string, string> = {};

        for (const h of headers) {
          const norm = normalizeHeader(h);
          if (COLUMN_MAP[norm]) {
            mapping[h] = COLUMN_MAP[norm];
            columnMapping[h] = COLUMN_MAP[norm];
          } else {
            // Fallback "contains" matching, longest alias first so "adresse ip" wins over "ip"
            const match = Object.entries(COLUMN_MAP)
              .sort((a, b) => b[0].length - a[0].length)
              .find(([key]) => norm.includes(key) || key.includes(norm));
            if (match) {
              mapping[h] = match[1];
              columnMapping[h] = match[1];
            }
          }
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        const mappedFields = new Set(Object.values(mapping));
        if (!mappedFields.has("asset")) {
          errors.push("Colonne requise manquante : asset");
          resolve({ items: [], errors, warnings, columnMapping });
          return;
        }
        if (!mappedFields.has("modele")) {
          warnings.push("Colonne 'Modèle' non détectée — les imprimantes seront importées sans modèle.");
        }
        if (!mappedFields.has("service")) {
          warnings.push("Colonne 'Service' non détectée — les imprimantes seront importées sans service.");
        }

        const items: ParsedPrinter[] = [];
        const seen = new Set<string>();

        for (const row of rows) {
          const item = EMPTY_PRINTER();

          for (const [col, field] of Object.entries(mapping)) {
            const val = String(row[col] ?? "").trim();
            if (field === "date_enregistrement") {
              item.date_enregistrement = normalizeDate(val) || null;
            } else if (field === "warranty_duration") {
              const n = parseInt(val, 10);
              item.warranty_duration = isNaN(n) ? null : n;
            } else {
              (item as unknown as Record<string, unknown>)[field] = val;
            }
          }

          // Skip rows without asset — c'est la clé d'unicité
          if (!item.asset) continue;

          // Dédoublonnage intra-fichier : un upsert sur des assets dupliqués échoue
          if (seen.has(item.asset)) {
            warnings.push(`Asset "${item.asset}" présent plusieurs fois — seule la première ligne est conservée.`);
            continue;
          }
          seen.add(item.asset);

          items.push(item);
        }

        if (items.length === 0) {
          errors.push("Aucune ligne valide trouvée dans le fichier (colonne asset vide partout).");
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
