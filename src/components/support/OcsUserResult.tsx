import { ExternalLink, MapPin, MonitorSmartphone } from "lucide-react";
import { useOcsUser, looksLikeUid, type OcsUserMachine } from "@/hooks/useOcsUser";

/**
 * Volet OCS de la recherche rapide du support.
 *
 * Il tourne EN PLUS des inventaires, pas à leur place : un collaborateur peut
 * très bien avoir une ligne au siège et une session OCS relevée ailleurs, et
 * c'est justement l'écart qui renseigne.
 *
 * Les collaborateurs du réseau agences, eux, ne sont volontairement pas saisis
 * en base : ils n'ont pas de poste attribué et changent d'agence régulièrement.
 * Leur uid ne dit donc rien de leur localisation — mais l'IP relevée par OCS la
 * donne, via le sous-réseau de l'agence.
 *
 * D'où l'ordre d'affichage : l'agence d'abord, c'est la réponse cherchée ;
 * l'IP et sa date ensuite, parce qu'elles disent ce que la réponse vaut.
 */

/** « 2026-09-15 00:00:00 » — le format d'OCS, que Safari refuse tel quel. */
const parseOcsDate = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Âge de la donnée, en clair.
 *
 * C'est la moitié utile de l'information : une IP inventoriée ce matin se
 * tente, une IP de trois semaines ne se tente pas. Afficher l'adresse sans son
 * âge la ferait passer pour du temps réel.
 */
const freshness = (d: Date | null) => {
  if (!d) return "date inconnue";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (days <= 0) return `inventorié aujourd'hui`;
  if (days === 1) return `inventorié hier (${date})`;
  return `inventorié il y a ${days} jours (${date})`;
};

const Machine = ({ m }: { m: OcsUserMachine }) => {
  const d = parseOcsDate(m.lastInventory);
  const stale = d ? Date.now() - d.getTime() > 14 * 86400000 : true;
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/40 py-2.5 last:border-0">
      <span className="font-mono text-sm font-semibold text-foreground">{m.name ?? "?"}</span>
      {m.agence ? (
        <span
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground"
          title={`Sous-réseau ${m.agence.sousReseau}`}
        >
          <MapPin size={12} className="text-primary" />
          {m.agence.agence}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">agence non identifiée</span>
      )}
      <span className="font-mono text-sm text-primary">{m.ipAddress ?? "IP inconnue"}</span>
      <span className={`text-xs ${stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
        {freshness(d)}
      </span>
      {(m.manufacturer || m.model || m.osName) && (
        <span className="text-xs text-muted-foreground">
          {[m.manufacturer, m.model, m.osName].filter(Boolean).join(" · ")}
        </span>
      )}
      <a
        href={m.consoleUrl}
        target="_blank"
        rel="noreferrer"
        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        OCS <ExternalLink size={11} />
      </a>
    </li>
  );
};

export default function OcsUserResult({ query }: { query: string }) {
  const plausible = looksLikeUid(query);
  const { data, isFetching } = useOcsUser(query, plausible);

  // Une saisie qui n'est pas un identifiant — un asset, un nom avec espaces —
  // ne vaut pas un appel : OCS n'aurait rien à en dire.
  if (!plausible) return null;

  if (isFetching) {
    return <p className="text-xs text-muted-foreground">Recherche des sessions dans OCS…</p>;
  }

  if (!data?.machines?.length) {
    // Dit explicitement, et non par une absence : « rien trouvé » et « pas
    // cherché » ne s'équivalent pas quand on cherche où se trouve quelqu'un.
    return (
      <p className="text-xs text-muted-foreground">
        Aucune session OCS pour «&nbsp;<span className="font-mono">{query}</span>&nbsp;».
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <MonitorSmartphone size={15} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Sessions relevées par OCS
        </h3>
      </div>
      {/* L'avertissement est au-dessus de la donnée, pas en note de bas de page :
          c'est une session au dernier inventaire, pas une connexion en direct. */}
      <p className="mb-3 text-xs text-muted-foreground">
        Dernière session pour «&nbsp;<span className="font-mono">{data.uid}</span>&nbsp;».
        L'agence est déduite du sous-réseau de l'adresse, relevée à l'inventaire indiqué —
        ce n'est pas une position en direct, et une personne qui a changé d'agence depuis
        apparaîtra encore à l'ancienne.
      </p>
      <ul>
        {data.machines.map((m) => <Machine key={m.id ?? m.name} m={m} />)}
      </ul>
    </div>
  );
}
