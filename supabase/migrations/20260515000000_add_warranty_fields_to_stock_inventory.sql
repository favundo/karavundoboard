ALTER TABLE public.stock_inventory
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_duration INTEGER DEFAULT NULL;
