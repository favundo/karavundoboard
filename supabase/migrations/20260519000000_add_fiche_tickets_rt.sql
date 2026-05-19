create table if not exists fiche_tickets_rt (
  id           uuid        primary key default gen_random_uuid(),
  asset_id     text        not null,
  source       text        not null,
  asset        text        not null,
  ticket_rt    text        not null,
  note         text,
  technicien   text,
  created_at   timestamptz not null default now()
);

create index if not exists fiche_tickets_rt_asset_id_idx on fiche_tickets_rt (asset_id);
