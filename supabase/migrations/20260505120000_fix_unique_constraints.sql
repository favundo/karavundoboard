-- Fix: ensure full UNIQUE constraints exist on 'asset' columns for PostgREST upsert support.
-- The previous migration (20260225090407) failed because it tried to CREATE UNIQUE INDEX
-- with the same name as a constraint it had just added (ADD CONSTRAINT creates an index
-- with the same name automatically). The whole migration was rolled back, leaving only
-- partial unique indexes (from 20260225085017) which PostgREST does not support for upsert.

-- Step 1: drop existing constraints (also drops their backing indexes)
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_asset_unique;
ALTER TABLE public.abcroisiere_inventory DROP CONSTRAINT IF EXISTS abcroisiere_inventory_asset_unique;
ALTER TABLE public.agency_inventory DROP CONSTRAINT IF EXISTS agency_inventory_asset_unique;

-- Step 2: drop any remaining partial unique indexes
DROP INDEX IF EXISTS inventory_items_asset_unique;
DROP INDEX IF EXISTS abcroisiere_inventory_asset_unique;
DROP INDEX IF EXISTS agency_inventory_asset_unique;

-- Step 3: ensure no empty asset values remain
UPDATE public.inventory_items SET asset = 'EMPTY-' || id::text WHERE asset = '';
UPDATE public.abcroisiere_inventory SET asset = 'EMPTY-' || id::text WHERE asset = '';
UPDATE public.agency_inventory SET asset = 'EMPTY-' || id::text WHERE asset = '';

-- Step 4: add full UNIQUE constraints (required by PostgREST for onConflict upsert)
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_asset_unique UNIQUE (asset);
ALTER TABLE public.abcroisiere_inventory ADD CONSTRAINT abcroisiere_inventory_asset_unique UNIQUE (asset);
ALTER TABLE public.agency_inventory ADD CONSTRAINT agency_inventory_asset_unique UNIQUE (asset);
