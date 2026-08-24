-- Rattrapage du schéma appliqué à la main en prod sans fichier de migration :
-- les tables `stock_inventory` et `decommissioned_items`, et la colonne
-- `eset_app` sur les trois inventaires historiques. Résultat, le jeu de
-- migrations du dépôt était injouable sur un environnement neuf :
-- 20260515000000 fait un ALTER sur stock_inventory, 20260721000000 un ALTER sur
-- decommissioned_items, et 20260810000000 lit inventory_items.eset_app.
--
-- Horodatage volontairement placé avant ces deux migrations pour rétablir
-- l'ordre de création.
--
-- Chaque bloc est gardé par `to_regclass(...) is null` : sur une base où la
-- table existe déjà — la prod — la migration ne fait STRICTEMENT rien, pas même
-- de toucher au RLS ou aux policies en place.

-- ── decommissioned_items ────────────────────────────────────────────────────
-- Définition d'origine (snippet Studio du 2026-04-16). La contrainte CHECK est
-- élargie ensuite : 'stock' par 20260721000000, 'province' par 20260810000000.
DO $$
BEGIN
  IF to_regclass('public.decommissioned_items') IS NULL THEN
    CREATE TABLE public.decommissioned_items (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      asset             TEXT        NOT NULL,
      serial_number     TEXT,
      source            TEXT        NOT NULL CHECK (source IN ('siege', 'agences', 'abcroisiere')),
      traite            BOOLEAN     NOT NULL DEFAULT false,
      decommissioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.decommissioned_items ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public read decommissioned"   ON public.decommissioned_items FOR SELECT USING (true);
    CREATE POLICY "Public insert decommissioned" ON public.decommissioned_items FOR INSERT WITH CHECK (true);
    CREATE POLICY "Public update decommissioned" ON public.decommissioned_items FOR UPDATE USING (true);
    CREATE POLICY "Public delete decommissioned" ON public.decommissioned_items FOR DELETE USING (true);
  END IF;
END $$;

-- ── stock_inventory ─────────────────────────────────────────────────────────
-- Aucune trace de sa création d'origine : structure reconstituée depuis
-- src/integrations/supabase/types.ts, calquée sur province_inventory. Les
-- colonnes warranty_* sont volontairement absentes ici, c'est 20260515000000
-- qui les ajoute.
-- La contrainte UNIQUE sur asset est requise par l'upsert de l'import
-- (onConflict: "asset", voir src/hooks/useStockInventory.ts).
DO $$
BEGIN
  IF to_regclass('public.stock_inventory') IS NULL THEN
    CREATE TABLE public.stock_inventory (
      id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      matricule        TEXT DEFAULT '',
      pseudo           TEXT DEFAULT '',
      nom              TEXT NOT NULL DEFAULT '',
      uid              TEXT DEFAULT '',
      service          TEXT NOT NULL DEFAULT '',
      type             TEXT NOT NULL DEFAULT 'portable',
      asset            TEXT NOT NULL DEFAULT '',
      sn               TEXT DEFAULT '',
      dns              TEXT DEFAULT '',
      absence          BOOLEAN DEFAULT false,
      remarques        TEXT DEFAULT '',
      windows_version  TEXT DEFAULT '',
      eset_app         TEXT DEFAULT '',
      pret             BOOLEAN DEFAULT false,
      pret_utilisateur TEXT DEFAULT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.stock_inventory ADD CONSTRAINT stock_inventory_asset_unique UNIQUE (asset);

    ALTER TABLE public.stock_inventory ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public read stock"   ON public.stock_inventory FOR SELECT USING (true);
    CREATE POLICY "Public insert stock" ON public.stock_inventory FOR INSERT WITH CHECK (true);
    CREATE POLICY "Public update stock" ON public.stock_inventory FOR UPDATE USING (true);
    CREATE POLICY "Public delete stock" ON public.stock_inventory FOR DELETE USING (true);
  END IF;
END $$;

-- ── eset_app sur les inventaires historiques ────────────────────────────────
-- Colonne ajoutée à la main en prod (remontée de l'état ESET, voir
-- /api/eset/computer). 20260810000000 la lit sur inventory_items pour peupler
-- province_inventory : sans elle, la migration échoue sur une base neuve.
ALTER TABLE public.inventory_items       ADD COLUMN IF NOT EXISTS eset_app TEXT DEFAULT '';
ALTER TABLE public.abcroisiere_inventory ADD COLUMN IF NOT EXISTS eset_app TEXT DEFAULT '';
ALTER TABLE public.agency_inventory      ADD COLUMN IF NOT EXISTS eset_app TEXT DEFAULT '';
