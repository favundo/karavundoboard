export interface Technician {
  id: string;
  label: string;
  email: string;
  bgColor: string;
}

export const TECHNICIANS: Technician[] = [
  { id: 'nehad',         label: 'Nehad',          email: 'nehad@karavel.com',         bgColor: '#3b82f6' },
  { id: 'zkarroum',      label: 'Z. Karroum',      email: 'zkarroum@karavel.com',      bgColor: '#10b981' },
  { id: 'maabid',        label: 'M. Abid',         email: 'maabid@karavel.com',        bgColor: '#f59e0b' },
  { id: 'cananthakumar', label: 'C. Ananthakumar', email: 'cananthakumar@karavel.com', bgColor: '#8b5cf6' },
  { id: 'rrinville',     label: 'R. Rinville',     email: 'rrinville@karavel.com',     bgColor: '#ef4444' },
  { id: 'favundo',       label: 'F. Avundo',       email: 'ext-favundo@karavel.com',       bgColor: '#ec4899' },
];

export const getTechnicianById = (id: string) =>
  TECHNICIANS.find((t) => t.id === id);
