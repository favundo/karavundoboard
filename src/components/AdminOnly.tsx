import { ShieldAlert, X } from 'lucide-react';
import { useMe } from '@/hooks/useMe';

/**
 * Appartenance au groupe administrateurs (karinventaire-admin), telle
 * qu'Authelia la transmet.
 *
 * ⚠️  C'est un GARDE-FOU CONTRE L'ERREUR, pas une barrière de sécurité. Un
 * technicien authentifié atteint PostgREST directement depuis la console de son
 * navigateur, avec la clé anonyme du bundle : ce contrôle l'empêche de se
 * tromper, pas de le vouloir. Une vraie barrière supposerait de faire transiter
 * les écritures par l'API Express, qui vérifierait Remote-Groups côté serveur.
 *
 * Tant que l'identité n'est pas connue — chargement, développement sans
 * DEV_USER — on répond `false` : on masque par défaut plutôt que d'exposer une
 * action destructrice le temps d'une requête.
 */
export function useIsAdmin(): boolean {
  const { data: me } = useMe();
  return me?.isAdmin ?? false;
}

/** N'affiche ses enfants qu'aux administrateurs. */
export const AdminOnly = ({ children }: { children: React.ReactNode }) => {
  const isAdmin = useIsAdmin();
  return isAdmin ? <>{children}</> : null;
};

/**
 * Second rideau, à l'intérieur des modals sensibles : même si un bouton était
 * oublié quelque part, l'action reste refusée.
 */
export const AdminRequired = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={16} />
          </div>
          <p className="text-sm font-semibold text-foreground">Action réservée</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-5 py-5 text-sm text-muted-foreground">
        <p>
          Cette opération écrase l'inventaire en masse : elle est réservée aux
          membres du groupe <span className="font-mono text-foreground">karinventaire-admin</span>.
        </p>
        <p className="mt-3">
          Rapprochez-vous d'un administrateur si vous devez la lancer.
        </p>
      </div>
      <div className="flex justify-end border-t border-border px-5 py-3">
        <button
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
);
