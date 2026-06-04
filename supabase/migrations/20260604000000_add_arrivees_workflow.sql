-- Suivi des arrivées (workflow par ticket RT « Creation de compte »).
-- Les données d'identité (prénom, nom, uid, service…) viennent de RT à la volée ;
-- cette table ne stocke QUE l'état de traitement. Le mot de passe n'est jamais
-- persisté : seule la date d'envoi est conservée.
create table if not exists arrivees_workflow (
  ticket_rt          text        primary key,
  compte_ldap        boolean     not null default false,
  logiciels_metiers  boolean     not null default false,
  telephone          boolean     not null default false,
  technicien         text,
  mdp_envoye_at      timestamptz,
  cloture            boolean     not null default false,
  cloture_at         timestamptz,
  updated_at         timestamptz not null default now()
);
