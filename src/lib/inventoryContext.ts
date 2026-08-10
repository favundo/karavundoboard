// Central definitions for the two "Groupes" inventory scopes (Siège vs Province).
// The Province table holds assets whose service is one of the province platforms.

export type InventoryTableName = "inventory_items" | "province_inventory";

// Services routed to the Groupes Province table.
export const PROVINCE_SERVICES = [
  "Groupes - Plateforme Lille",
  "Groupes - Plateforme Nantes",
] as const;

export interface InventoryCtx {
  section: "siege" | "province";
  table: InventoryTableName;
  queryKey: string; // React Query key
  decommSource: string; // value stored in decommissioned_items.source
  title: string;
  subtitle: string;
}

export const SIEGE_CTX: InventoryCtx = {
  section: "siege",
  table: "inventory_items",
  queryKey: "inventory",
  decommSource: "siege",
  title: "Parc Siège",
  subtitle: "Inventaire du parc informatique",
};

export const PROVINCE_CTX: InventoryCtx = {
  section: "province",
  table: "province_inventory",
  queryKey: "province-inventory",
  decommSource: "province",
  title: "Parc - Groupes Province",
  subtitle: "Plateformes Lille & Nantes",
};

// Which table an asset belongs to, based on its service.
export const tableForService = (service: string): InventoryTableName =>
  (PROVINCE_SERVICES as readonly string[]).includes((service ?? "").trim())
    ? "province_inventory"
    : "inventory_items";

export const queryKeyForTable = (table: InventoryTableName): string =>
  table === "province_inventory" ? "province-inventory" : "inventory";
