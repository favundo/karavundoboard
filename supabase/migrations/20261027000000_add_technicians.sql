-- Techniciens du support — jusqu'ici codés en dur, deux fois (src/lib/technicians.ts
-- et server/index.js). Gérés désormais depuis /gestion.
--
-- `id` est le sAMAccountName AD : il correspond à Remote-User (Authelia), aux
-- logins RT et à support_appointments.uid_technicien. Pas de table de
-- correspondance.
--
-- SUPPRESSION = ARCHIVAGE (`active = false`). Les rendez-vous passés et les
-- stats RT gardent l'uid ; effacer la ligne leur ferait perdre libellé et
-- couleur. Un technicien archivé disparaît des listes de choix, pas de
-- l'historique.

create table if not exists public.technicians (
  id             text         primary key,
  label          text         not null,
  email          text         not null,
  bg_color       text         not null default '#64748b',
  -- Prénom pour les mails (rapport mensuel, invitations).
  first_name     text,
  -- Nom sous lequel la personne apparaît dans Axialys (op_name). Seul lien
  -- RT ↔ téléphonie ; sans lui, pas de partie téléphonie au rapport mensuel.
  axialys        text,
  -- Technicien régulier : destinataire du rapport mensuel ET compté dans la
  -- moyenne d'équipe. Faux pour un renfort ponctuel (décision du 05/10/2026).
  monthly_report boolean      not null default false,
  active         boolean      not null default true,
  created_at     timestamptz  not null default now()
);

alter table public.technicians enable row level security;

-- Même politique que le reste : la barrière réelle est Authelia devant Nginx.
-- Les écritures passent par l'API Express, qui vérifie Remote-Groups.
drop policy if exists "technicians_all" on public.technicians;
create policy "technicians_all" on public.technicians
  for all using (true) with check (true);

insert into public.technicians (id, label, email, bg_color, first_name, axialys, monthly_report) values
  ('nehad',         'Nehad',           'nehad@karavel.com',         '#3b82f6', 'Nehad',    'Abdelrahim', true),
  ('zkarroum',      'Z. Karroum',      'zkarroum@karavel.com',      '#10b981', 'Zahra',    null,         true),
  ('maabid',        'M. Abid',         'maabid@karavel.com',        '#f59e0b', 'Mahran',   'Mahran',     true),
  ('cananthakumar', 'C. Ananthakumar', 'cananthakumar@karavel.com', '#8b5cf6', 'Christy',  'Christy',    true),
  ('rrinville',     'R. Rinville',     'rrinville@karavel.com',     '#ef4444', 'Rémy',     'Remy',       true),
  ('ext-favundo',   'F. Avundo',       'ext-favundo@karavel.com',   '#ec4899', 'Frédéric', null,         true),
  ('blouis',        'B. Louis',        'blouis@karavel.com',        '#06b6d4', null,       null,         false)
on conflict (id) do nothing;

comment on table public.technicians is
  'Techniciens du support (id = sAMAccountName AD). Gérés depuis /gestion via '
  'l''API Express ; suppression = archivage (active = false).';

notify pgrst, 'reload schema';
