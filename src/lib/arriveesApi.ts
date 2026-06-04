// Actions serveur pour l'onglet Arrivées (proxy RT + envoi de mail).

export async function sendMdp(payload: {
  email: string;
  prenom: string | null;
  nom: string | null;
  login: string | null;
  mdp: string;
}): Promise<void> {
  const res = await fetch('/api/rt/send-mdp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? "Échec de l'envoi du mot de passe");
  }
}

export async function closeArrivee(ticketId: string): Promise<void> {
  const res = await fetch('/api/rt/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? 'Échec de la clôture du ticket');
  }
}
