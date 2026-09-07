-- Téléphonie du support IT — appels Axialys
--
-- POURQUOI UNE TABLE, ET PAS UN APPEL DIRECT À AXIALYS COMME POUR RT :
-- /vm/calls/in et /vm/calls/out ignorent les paramètres dt / dt_end et
-- renvoient toujours les dernières 24-48 h, quelle que soit la fenêtre
-- demandée (vérifié le 07/09/2026 : six fenêtres de mars à septembre ont rendu
-- les mêmes 2100 appels). L'historique n'est donc PAS rejouable par l'API : si
-- on ne persiste pas au fil de l'eau, il est perdu. Un job quotidien écrit ici,
-- et les statistiques se calculent sur cette table.
--
-- PÉRIMÈTRE : uniquement le groupe « Support IT KVL ». Le token Axialys voit
-- toute la téléphonie Karavel, y compris la relation client sous-traitée chez
-- Intelcia. Rien de tout cela n'a sa place dans un dashboard d'inventaire IT,
-- et le filtre est appliqué À L'INGESTION, pas à l'affichage.

create table if not exists public.axialys_calls (
  -- Identifiant Axialys de l'appel. Négatif pour les sortants dans l'export
  -- CSV du portail — d'où bigint signé et non un compteur applicatif : c'est
  -- lui qui rend l'ingestion idempotente, le job quotidien recouvrant
  -- forcément la veille.
  id_appel          bigint       primary key,

  direction         text         not null check (direction in ('in', 'out')),
  call_date         timestamptz  not null,

  -- Vocabulaire observé sur 30 jours : ANSWER, ABORT (raccroché dans la file
  -- avant de faire sonner), CANCEL (raccroché pendant la sonnerie), NOANSWER
  -- (poste sonné, non pris), SIP (sortant non abouti). Volontairement non
  -- contraint : Axialys peut en ajouter, et un statut inconnu doit être stocké
  -- puis compté à part, pas rejeté à l'ingestion.
  status            text,

  service_number    text,
  -- Numéro de l'appelant. Ce sont des collaborateurs Karavel appelant leur
  -- support IT, pas des clients. Conservé parce qu'il est indispensable au
  -- rapprochement « appel manqué → rappelé », qui est le seul moyen de savoir
  -- si un manqué a été rattrapé. À ne jamais exposer tel quel dans l'interface.
  caller_number     text,
  -- Cible de routage interne, pas un numéro : « centrex:17351 », « broadcast ».
  called_number     text,

  group_name        text,
  first_group_name  text,
  rub_name          text,

  -- Prénom + équipe (« Abdelrahim TSI »). id_op est le seul identifiant
  -- stable : op_name n'est renseigné que ~2 h après l'appel côté Axialys, ce
  -- que le job de nuit laisse largement passer.
  op_name           text,
  id_op             integer,
  tags              text,

  duration          integer,   -- durée totale
  duration_ring     integer,   -- sonnerie
  duration_svi      integer,   -- passé dans le SVI avant la file
  duration_wait     integer,   -- attente avant décroché
  duration_comm     integer,   -- communication
  duration_hold     integer,   -- mise en attente pendant la communication
  post_appel        integer,   -- traitement après raccroché

  -- 'api' = job quotidien (champs complets) ; 'csv' = rattrapage depuis un
  -- export du portail, qui ne fournit QUE la durée de communication. Les
  -- moyennes d'attente doivent donc écarter les lignes 'csv', sans quoi elles
  -- comptent des zéros qui n'en sont pas.
  source            text         not null default 'api' check (source in ('api', 'csv')),
  imported_at       timestamptz  not null default now()
);

-- Les stats balaient toujours une période, souvent un mois ou une année.
create index if not exists axialys_calls_date_idx
  on public.axialys_calls (call_date desc);

-- Le classement par agent, et le filtre « mes appels ».
create index if not exists axialys_calls_op_idx
  on public.axialys_calls (id_op, call_date desc);

-- Le rapprochement manqué → rappel se fait par numéro, sur une fenêtre courte.
create index if not exists axialys_calls_caller_idx
  on public.axialys_calls (caller_number, call_date);

alter table public.axialys_calls enable row level security;

-- Même politique que le reste du projet : la barrière réelle est Authelia
-- devant Nginx, PostgREST n'étant pas exposé sans authentification.
-- Voir deploy/authelia/README.md.
drop policy if exists "axialys_calls_all" on public.axialys_calls;
create policy "axialys_calls_all" on public.axialys_calls
  for all using (true) with check (true);

comment on table public.axialys_calls is
  'Appels du groupe Axialys « Support IT KVL ». Alimentée par le job quotidien '
  'de server/index.js (l''API Axialys ne rend que les dernières 24-48 h) et par '
  'l''import des exports CSV du portail pour le rattrapage historique.';

-- PostgREST met son schéma en cache : sans ce signal, il répond PGRST205
-- « table not found » sur une table pourtant créée, et l'API renvoie une erreur
-- de lecture jusqu'au prochain redémarrage.
notify pgrst, 'reload schema';
