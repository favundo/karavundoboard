/**
 * Normalisation d'un numéro de ticket RT saisi à la main.
 *
 * Trois formes arrivent dans un champ de saisie : le numéro seul, le numéro
 * préfixé d'un croisillon, et l'URL entière collée depuis le navigateur. Les
 * trois désignent le même ticket, autant les accepter.
 *
 * Tout le reste renvoie une chaîne vide plutôt qu'une valeur devinée : un
 * numéro faux est pire qu'un numéro manquant — il rattache l'intervention au
 * ticket de quelqu'un d'autre, en silence.
 */
export function normaliseTicketNumber(input: string): string {
  const raw = input.trim().replace(/^#/, '');
  if (/^\d{1,10}$/.test(raw)) return raw;
  const fromUrl = raw.match(/[?&]id=(\d{1,10})\b/);
  return fromUrl ? fromUrl[1] : '';
}
