import { useQuery } from "@tanstack/react-query";

/** Agence déduite du sous-réseau de l'IP, avec le réseau qui l'a désignée. */
export interface OcsAgencyMatch {
  agence: string;
  /** Rendu avec l'agence pour qu'un rapprochement faux se voie. */
  sousReseau: string;
}

export interface OcsUserMachine {
  id: number | null;
  name: string | null;
  userId: string | null;
  /** IP de la machine au dernier inventaire — à ne jamais afficher sans sa date. */
  ipAddress: string | null;
  lastInventory: string | null;
  /**
   * Là où la personne se trouvait, déduit de l'IP.
   *
   * C'est l'intérêt principal pour le réseau agences : les collaborateurs n'y
   * ont pas de poste attribué et changent d'agence régulièrement, donc leur uid
   * ne dit rien de leur localisation — l'IP, si.
   */
  agence: OcsAgencyMatch | null;
  osName: string | null;
  manufacturer: string | null;
  model: string | null;
  consoleUrl: string;
}

export interface OcsUser {
  uid: string;
  /** La plus récemment inventoriée en premier. */
  machines: OcsUserMachine[];
}

/**
 * Un uid ressemble-t-il assez à un identifiant pour valoir un appel à OCS ?
 *
 * La recherche globale accepte aussi des assets, des numéros de série et des
 * noms avec espaces : les envoyer à OCS ne rendrait jamais rien, et ferait une
 * requête à chaque frappe pour ce néant.
 */
export const looksLikeUid = (q: string) => /^[a-z][a-z0-9._-]{1,30}$/i.test(q.trim());

/**
 * Machines d'un collaborateur d'après OCS, quand l'inventaire ne le connaît pas.
 *
 * Volontairement silencieux sur l'échec : c'est un repli, affiché sous un
 * « aucun résultat ». Une erreur rouge de plus n'aiderait personne à ce moment-là.
 */
export const useOcsUser = (uid: string | null, enabled: boolean) =>
  useQuery<OcsUser | null>({
    queryKey: ["ocs-user", uid],
    queryFn: async () => {
      const res = await fetch(`/api/ocs/user/${encodeURIComponent(uid!)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: enabled && !!uid && looksLikeUid(uid),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
