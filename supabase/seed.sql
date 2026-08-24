-- Jeu de données de DÉVELOPPEMENT LOCAL uniquement.
--
-- Rejoué automatiquement par `supabase db reset` (voir [db.seed] dans
-- config.toml). Il n'est JAMAIS exécuté en production : la prod est un Supabase
-- self-hosted où le SQL est passé à la main dans Studio.
--
-- Aucune donnée réelle ici : les identités sont inventées. Le seul point fidèle
-- à la prod est la liste des 20 services, car plusieurs écrans construisent
-- leurs listes déroulantes à partir de `inventory_items.service` (voir
-- useServices() dans src/hooks/useSupportAppointments.ts) — sans lignes en base,
-- le sélecteur de service de la prise de RDV reste vide.
--
-- Idempotent : `on conflict (asset)` permet de le rejouer sans doublon.

insert into public.inventory_items
  (asset, sn, type, nom, uid, pseudo, matricule, service, dns, windows_version, eset_app)
select
  'DEV' || lpad((row_number() over ())::text, 4, '0'),
  'SN-DEV-' || lpad((row_number() over ())::text, 4, '0'),
  case when i = 1 then 'portable' else 'fixe' end,
  s.nom_fictif,
  s.uid_fictif,
  s.uid_fictif,
  'M' || lpad((row_number() over ())::text, 5, '0'),
  s.service,
  lower(s.uid_fictif) || '.karavel.com',
  case when i = 1 then 'Windows 11' else 'Windows 10' end,
  'ESET Endpoint Security'
from (values
  ('Administration et Finance', 'Alice Martin',    'amartin'),
  ('Agence',                    'Bruno Leroy',     'bleroy'),
  ('BO',                        'Carla Dupont',    'cdupont'),
  ('Comex',                     'David Moreau',    'dmoreau'),
  ('Communication et Design',   'Elsa Girard',     'egirard'),
  ('Data Client',               'Farid Benali',    'fbenali'),
  ('Direction Produit',         'Gaelle Petit',    'gpetit'),
  ('Externe',                   'Hugo Roux',       'hroux'),
  ('Fram',                      'Ines Fontaine',   'ifontaine'),
  ('Groupes',                   'Julien Blanc',    'jblanc'),
  ('Indiv CE',                  'Karim Haddad',    'khaddad'),
  ('Informatique',              'Laura Chevalier', 'lchevalier'),
  ('Juridique',                 'Marc Lemoine',    'mlemoine'),
  ('Marketing',                 'Nadia Sassi',     'nsassi'),
  ('Production',                'Olivier Faure',   'ofaure'),
  ('Présidence',                'Pauline Mercier', 'pmercier'),
  ('Qualité',                   'Quentin Noel',    'qnoel'),
  ('Relation Client',           'Rachel Vidal',    'rvidal'),
  ('Ressources Humaines',       'Samir Toure',     'stoure'),
  ('call ab',                   'Tania Lopez',     'tlopez')
) as s(service, nom_fictif, uid_fictif)
cross join generate_series(1, 2) as i
on conflict (asset) do nothing;
