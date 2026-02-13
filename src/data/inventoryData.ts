export interface InventoryItem {
  matricule: string;
  pseudo: string;
  service: string;
  absence: boolean;
  nom: string;
  uid: string;
  dns: string;
  type: "portable" | "Pc Fixe";
  asset: string;
  sn: string;
  remarques: string;
}

export const inventoryData: InventoryItem[] = [];

const computeServiceStats = () => {
  const stats: Record<string, number> = {};
  inventoryData.forEach((item) => {
    stats[item.service] = (stats[item.service] || 0) + 1;
  });
  return stats;
};

const computeDeviceTypeStats = () => {
  let portable = 0;
  let pcFixe = 0;
  inventoryData.forEach((item) => {
    if (item.type === "portable") portable++;
    else pcFixe++;
  });
  return { portable, "Pc Fixe": pcFixe };
};

const computeAbsentEmployees = () => {
  const absent = new Set<string>();
  inventoryData.forEach((item) => {
    if (item.absence && item.uid) absent.add(item.uid.toLowerCase());
  });
  return absent.size;
};

const computeUniqueEmployees = () => {
  const uids = new Set<string>();
  inventoryData.forEach((item) => {
    if (item.uid && !["Back", "back", "Call", "call", "Formation", "SAV", "stock", "stock a retirer", "Media partenariat", "dev"].includes(item.uid)) {
      uids.add(item.uid.toLowerCase());
    }
  });
  return uids.size;
};

const computeMultiDeviceEmployees = () => {
  const counts: Record<string, number> = {};
  inventoryData.forEach((item) => {
    if (item.uid && !["Back", "back", "Call", "call", "Formation", "SAV", "stock", "stock a retirer", "Media partenariat", "dev"].includes(item.uid)) {
      const key = item.uid.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  return Object.values(counts).filter((c) => c > 1).length;
};

export const serviceStats = computeServiceStats();
export const deviceTypeStats = computeDeviceTypeStats();
export const totalDevices = inventoryData.length;
export const totalEmployees = computeUniqueEmployees();
export const absentEmployees = computeAbsentEmployees();
export const employeesWithMultipleDevices = computeMultiDeviceEmployees();

export const serviceColors: Record<string, string> = {
  "Other": "hsl(0, 0%, 45%)",
};
