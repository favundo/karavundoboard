
-- Drop partial unique indexes (not supported by PostgREST for upsert)
DROP INDEX IF EXISTS inventory_items_asset_unique;
DROP INDEX IF EXISTS abcroisiere_inventory_asset_unique;
DROP INDEX IF EXISTS agency_inventory_asset_unique;

-- Replace empty assets with unique placeholders so we can add a real UNIQUE constraint
UPDATE public.inventory_items SET asset = 'EMPTY-' || id::text WHERE asset = '';
UPDATE public.abcroisiere_inventory SET asset = 'EMPTY-' || id::text WHERE asset = '';
UPDATE public.agency_inventory SET asset = 'EMPTY-' || id::text WHERE asset = '';

-- Add real UNIQUE constraints
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_asset_unique UNIQUE (asset);
ALTER TABLE public.abcroisiere_inventory ADD CONSTRAINT abcroisiere_inventory_asset_unique UNIQUE (asset);
ALTER TABLE public.agency_inventory ADD CONSTRAINT agency_inventory_asset_unique UNIQUE (asset);
