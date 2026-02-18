
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS windows_version text DEFAULT ''::text;
