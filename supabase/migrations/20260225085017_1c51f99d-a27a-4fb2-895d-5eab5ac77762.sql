
-- Partial unique indexes: asset must be unique only when not empty
CREATE UNIQUE INDEX inventory_items_asset_unique ON public.inventory_items (asset) WHERE asset <> '';
CREATE UNIQUE INDEX abcroisiere_inventory_asset_unique ON public.abcroisiere_inventory (asset) WHERE asset <> '';
CREATE UNIQUE INDEX agency_inventory_asset_unique ON public.agency_inventory (asset) WHERE asset <> '';
