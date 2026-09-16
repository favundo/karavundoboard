-- Synchronisation automatique de l'inventaire depuis ESET et OCS
--
-- PÉRIMÈTRE : windows_version seulement. eset_app reste à la saisie manuelle —
-- ESET ne publie pas le produit installé par son API REST (activeProducts et
-- deployedComponents vides sur les 904 devices, 404 sur toute autre ressource,
-- sondé le 16/09/2026).
--
-- POURQUOI DEUX COLONNES DE TRACE PLUTÔT QUE RIEN :
-- windows_version était jusqu'ici saisie à la main (import Excel). Une fois
-- qu'un job l'écrase toutes les nuits, plus personne ne peut dire, en regardant
-- une ligne, si la valeur vient d'être confirmée par l'outil ou si elle date du
-- dernier import parce que le poste n'a jamais été retrouvé. Les deux cas
-- affichent le même « Windows 10 ».
--
-- LEÇON AXIALYS : une ingestion en panne et un parc stable rendent tous les
-- deux « 0 ligne modifiée ». D'où inventory_sync_runs, qui enregistre aussi le
-- volume rendu par la source AVANT rapprochement : si ESET rend 0 device, c'est
-- une panne ; s'il en rend 900 et que rien ne change, c'est un parc à jour.

alter table public.inventory_items
  -- Date du dernier rapprochement RÉUSSI avec un outil, pas de la dernière
  -- passe : un poste éteint depuis trois semaines garde une date de trois
  -- semaines, et c'est précisément l'information utile.
  add column if not exists synced_at   timestamptz,
  -- 'eset' | 'ocs'. Quel outil a fourni la dernière valeur : ESET et OCS ne
  -- nomment pas les OS pareil (« Windows 11 Pro » contre « Windows 11
  -- Professionnel »), et savoir d'où vient la ligne évite de chercher une
  -- incohérence là où il n'y a qu'une différence de vocabulaire.
  add column if not exists sync_source text;

create table if not exists public.inventory_sync_runs (
  id               uuid         primary key default gen_random_uuid(),
  started_at       timestamptz  not null default now(),
  finished_at      timestamptz,

  -- La table d'inventaire visée. Le job ne couvre aujourd'hui que
  -- inventory_items (siège) ; agency_inventory, province_inventory et
  -- abcroisiere_inventory suivront, et partageront cet historique.
  table_name       text         not null default 'inventory_items',

  -- 'cron' (passe de nuit) ou 'manual' (bouton « Maj » du dashboard).
  trigger          text         not null check (trigger in ('cron', 'manual')),
  -- sAMAccountName du déclencheur pour une passe manuelle, null pour le cron.
  uid_declencheur  text,

  -- Volumes rendus par les sources AVANT tout rapprochement. C'est la ligne qui
  -- distingue la panne du parc stable — voir l'en-tête.
  eset_devices     integer      not null default 0,
  ocs_lookups      integer      not null default 0,

  -- Postes d'inventaire retrouvés dans au moins une source.
  matched          integer      not null default 0,
  -- Parmi eux, ceux dont windows_version a réellement changé.
  updated          integer      not null default 0,
  -- Postes d'inventaire introuvables partout : ni ESET, ni OCS. Leur valeur
  -- est laissée telle quelle, jamais effacée — une absence de l'outil n'est pas
  -- une preuve que la machine n'existe plus.
  unmatched        integer      not null default 0,

  -- Passe interrompue : message d'erreur, et finished_at renseigné quand même.
  error_message    text
);

-- L'affichage ne veut que les dernières passes, par table.
create index if not exists inventory_sync_runs_recent_idx
  on public.inventory_sync_runs (table_name, started_at desc);

alter table public.inventory_sync_runs enable row level security;

-- Même politique que le reste du projet : la barrière réelle est Authelia
-- devant Nginx, PostgREST n'étant pas exposé sans authentification.
-- Voir deploy/authelia/README.md.
drop policy if exists "inventory_sync_runs_all" on public.inventory_sync_runs;
create policy "inventory_sync_runs_all" on public.inventory_sync_runs
  for all using (true) with check (true);

comment on table public.inventory_sync_runs is
  'Historique des passes de synchronisation ESET/OCS vers les tables '
  'd''inventaire. eset_devices / ocs_lookups sont les volumes rendus par les '
  'sources avant rapprochement : ils distinguent une source en panne d''un parc '
  'sans changement, qui affichent sinon le même updated = 0.';

comment on column public.inventory_items.synced_at is
  'Dernier rapprochement réussi avec ESET ou OCS. Null = jamais retrouvé : la '
  'valeur affichée vient encore de l''import Excel.';

-- PostgREST met son schéma en cache : sans ce signal, il répond PGRST205
-- « table not found » sur une table pourtant créée.
notify pgrst, 'reload schema';
