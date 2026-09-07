import { LogOut } from "lucide-react";
import { useMe } from "@/hooks/useMe";

/**
 * Déconnexion du portail Authelia.
 *
 * Le portail est servi sur le sous-chemin `/authelia` du même vhost (voir
 * `session.cookies[].authelia_url` dans deploy/authelia/configuration.yml).
 * Sa route `/logout` détruit la session puis renvoie vers
 * `default_redirection_url`, c'est-à-dire l'application : privée de session,
 * elle repasse aussitôt par l'écran de connexion.
 *
 * Ce bloc Nginx n'est volontairement pas protégé par `auth_request`, il n'y a
 * donc pas de boucle possible.
 */
const LOGOUT_URL = "/authelia/logout";

/**
 * Bouton de déconnexion, à placer à côté de `<ThemeToggle />` dans l'en-tête de
 * chaque page. Comme toute la personnalisation liée à l'identité, il est
 * additif : hors authentification il ne s'affiche pas et rien ne bouge.
 */
export function LogoutButton() {
  const { data: me } = useMe();

  // Rien à déconnecter sans session. En développement (DEV_USER) il n'y a pas
  // d'Authelia devant Vite : le lien tomberait sur un 404.
  if (!me?.authenticated || me.dev) return null;

  return (
    <a
      href={LOGOUT_URL}
      title={`Se déconnecter (${me.displayName})`}
      aria-label="Se déconnecter"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
    >
      <LogOut size={16} />
    </a>
  );
}
