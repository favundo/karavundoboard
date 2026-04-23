import type { SupportAppointment } from '@/hooks/useSupportAppointments';

export const sendAppointmentEmail = async (
  type: 'create' | 'update' | 'close' | 'delete',
  appointment: SupportAppointment,
): Promise<void> => {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, appointment }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Erreur serveur');
    throw new Error(msg);
  }
};
