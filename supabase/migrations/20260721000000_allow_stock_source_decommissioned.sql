-- Autoriser la source 'stock' dans decommissioned_items
-- (le modal de décommission du stock insère source = 'stock')
ALTER TABLE decommissioned_items
  DROP CONSTRAINT IF EXISTS decommissioned_items_source_check;

ALTER TABLE decommissioned_items
  ADD CONSTRAINT decommissioned_items_source_check
  CHECK (source IN ('siege', 'agences', 'abcroisiere', 'stock'));
