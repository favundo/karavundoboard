-- Téléphonie du support IT — historique des états des agents Axialys
--
-- POURQUOI : la ligne décroche 58 % des appels, et le planning ne dit pas
-- pourquoi. Un agent connecté mais EN PAUSE n'est jamais sollicité par la file :
-- c'est ce qui fait les abandons de 13 h, sans un seul non-répondu. Cette table
-- garde les sessions et les pauses des agents du support, pour mesurer heure
-- par heure combien la ligne pouvait réellement faire sonner.
--
-- SOURCE : POST /vm/calls/status. Contrairement aux appels, l'historique SE
-- REJOUE (sondé le 05/10/2026, scripts/probe-axialys-status.js) — mais une
-- session n'apparaît qu'à la déconnexion. D'où une passe de nuit sur la
-- veille, et non une ingestion horaire.
--
-- PÉRIMÈTRE : les agents du support seulement (id_op relevés dans
-- axialys_calls). Le token voit les 300 agents de la téléphonie Karavel ; le
-- filtre est appliqué À L'INGESTION.
--
-- Usage : la disponibilité de la LIGNE, agrégée. Le motif de pause est stocké
-- pour pouvoir vérifier un chiffre, pas pour être affiché par personne.

create table if not exists public.axialys_agent_status (
  id_op       integer      not null,
  type        text         not null check (type in ('login', 'break')),
  -- Début de la session ou de la pause. L'API ne fournit pas d'identifiant :
  -- (id_op, type, started_at) en tient lieu.
  started_at  timestamptz  not null,
  duration    integer      not null,     -- secondes
  -- Code du motif de pause (« user6 » = Pause Dej) — userN = « Pause N+1 » du
  -- portail, vérifié le 05/10/2026 ; user15 = Indisponible. Null sur un login.
  infos       text,
  -- Jour (Europe/Paris) demandé à l'API. Sert à réécrire une journée entière
  -- quand on la rejoue.
  day         date         not null,
  imported_at timestamptz  not null default now(),
  primary key (id_op, type, started_at)
);

create index if not exists axialys_agent_status_day_idx
  on public.axialys_agent_status (day);

-- Journal des journées relevées. INDISPENSABLE : une journée où personne ne
-- s'est connecté et une journée que l'ingestion a ratée laissent toutes deux
-- zéro ligne dans la table ci-dessus. `fetched` (lignes rendues par Axialys,
-- tous agents Karavel, AVANT filtre) les distingue — 0 rendu est une panne,
-- 15 000 rendus dont 0 du support est une vraie journée vide.
create table if not exists public.axialys_status_days (
  day         date         primary key,
  fetched     integer      not null,
  kept        integer      not null,
  ingested_at timestamptz  not null default now()
);

alter table public.axialys_agent_status enable row level security;
alter table public.axialys_status_days  enable row level security;

-- Même politique que axialys_calls : la barrière réelle est Authelia devant
-- Nginx. Voir deploy/authelia/README.md.
drop policy if exists "axialys_agent_status_all" on public.axialys_agent_status;
create policy "axialys_agent_status_all" on public.axialys_agent_status
  for all using (true) with check (true);
drop policy if exists "axialys_status_days_all" on public.axialys_status_days;
create policy "axialys_status_days_all" on public.axialys_status_days
  for all using (true) with check (true);

comment on table public.axialys_agent_status is
  'Sessions (login) et pauses (break) des agents Axialys du support. Passe de '
  'nuit sur la veille dans server/index.js — l''historique se rejoue.';
comment on table public.axialys_status_days is
  'Journées relevées par l''ingestion des états Axialys, avec le volume rendu '
  'avant filtre : distingue une journée vide d''une ingestion en panne.';

notify pgrst, 'reload schema';
