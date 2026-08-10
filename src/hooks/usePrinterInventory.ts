import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrinterItem {
  id: string;
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
  created_at: string;
  updated_at: string;
}

type DbPrinterRow = {
  id: string;
  asset: string;
  modele: string | null;
  mac: string | null;
  ip: string | null;
  fabricant: string | null;
  hostname: string | null;
  sn: string | null;
  service: string | null;
  emplacement: string | null;
  date_enregistrement: string | null;
  warranty_duration: number | null;
  created_at: string;
  updated_at: string;
};

const dbToPrinter = (row: DbPrinterRow): PrinterItem => ({
  id: row.id,
  asset: row.asset ?? "",
  modele: row.modele ?? "",
  mac: row.mac ?? "",
  ip: row.ip ?? "",
  fabricant: row.fabricant ?? "",
  hostname: row.hostname ?? "",
  sn: row.sn ?? "",
  service: row.service ?? "",
  emplacement: row.emplacement ?? "",
  date_enregistrement: row.date_enregistrement,
  warranty_duration: row.warranty_duration,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const usePrinterInventory = () => {
  return useQuery({
    queryKey: ["printer-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printer_inventory")
        .select("*")
        .order("asset", { ascending: true });
      if (error) throw error;
      return (data as DbPrinterRow[]).map(dbToPrinter);
    },
  });
};

// Models available for the "Ajouter" dropdown.
export const PRINTER_MODELS = [
  "WF-C579R Series",
  "AM-C6000 Series",
  "EM-C800 Series",
  "WF-C20750 Series",
  "WF-C879R Series",
  "AM-C4000 Series",
] as const;

// Warranty end = date_enregistrement + warranty_duration years.
// Returns true when that end date is strictly before today.
export const isWarrantyExpired = (
  dateEnregistrement: string | null,
  warrantyDuration: number | null
): boolean => {
  if (!dateEnregistrement || warrantyDuration == null) return false;
  const end = new Date(dateEnregistrement);
  if (isNaN(end.getTime())) return false;
  end.setFullYear(end.getFullYear() + warrantyDuration);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
};
