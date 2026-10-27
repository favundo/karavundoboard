import { useSyncExternalStore } from 'react';

export interface Technician {
  id: string;
  label: string;
  email: string;
  bgColor: string;
  firstName?: string;
  axialys?: string;
  monthlyReport?: boolean;
  /** false = archivé : absent des listes de choix, gardé pour l'historique. */
  active?: boolean;
}

/**
 * Repli seulement : la liste fait foi dans la table `technicians`, gérée depuis
 * /gestion et servie par GET /api/technicians. Elle sert le temps du premier
 * chargement, et en développement sans API.
 */
const SEED: Technician[] = [
  { id: 'nehad',         label: 'Nehad',          email: 'nehad@karavel.com',         bgColor: '#3b82f6' },
  { id: 'zkarroum',      label: 'Z. Karroum',      email: 'zkarroum@karavel.com',      bgColor: '#10b981' },
  { id: 'maabid',        label: 'M. Abid',         email: 'maabid@karavel.com',        bgColor: '#f59e0b' },
  { id: 'cananthakumar', label: 'C. Ananthakumar', email: 'cananthakumar@karavel.com', bgColor: '#8b5cf6' },
  { id: 'rrinville',     label: 'R. Rinville',     email: 'rrinville@karavel.com',     bgColor: '#ef4444' },
  { id: 'ext-favundo',   label: 'F. Avundo',       email: 'ext-favundo@karavel.com',   bgColor: '#ec4899' },
  { id: 'blouis',        label: 'B. Louis',        email: 'blouis@karavel.com',        bgColor: '#06b6d4' },
];

// Registre au niveau du module : getTechnicianById est appelé hors composants
// (stats/format.ts). Les composants s'abonnent via useTechnicians().
let all: Technician[] = SEED;
let active: Technician[] = SEED;
const listeners = new Set<() => void>();

export function setTechnicians(list: Technician[]) {
  if (!list.length) return;
  all = list;
  active = list.filter((t) => t.active !== false);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export async function loadTechnicians() {
  try {
    const res = await fetch('/api/technicians');
    if (res.ok) setTechnicians(await res.json());
  } catch {
    // API injoignable : on garde la liste courante.
  }
}

/** Techniciens actifs — pour les listes de choix. */
export const useTechnicians = () => useSyncExternalStore(subscribe, () => active);

/** Tous, archivés compris — pour la gestion. */
export const useAllTechnicians = () => useSyncExternalStore(subscribe, () => all);

/** Archivés compris : un rendez-vous passé garde le libellé de son technicien. */
export const getTechnicianById = (id: string) => all.find((t) => t.id === id);
