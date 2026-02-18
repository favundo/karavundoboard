
-- Table for agency network inventory
CREATE TABLE public.agency_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sous_reseau TEXT NOT NULL DEFAULT '',
  masque TEXT NOT NULL DEFAULT '',
  agence TEXT NOT NULL DEFAULT '',
  asset TEXT NOT NULL DEFAULT '',
  sn TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_inventory ENABLE ROW LEVEL SECURITY;

-- Public CRUD policies (same pattern as inventory_items)
CREATE POLICY "Public read agency inventory"
  ON public.agency_inventory FOR SELECT USING (true);

CREATE POLICY "Public insert agency inventory"
  ON public.agency_inventory FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update agency inventory"
  ON public.agency_inventory FOR UPDATE USING (true);

CREATE POLICY "Public delete agency inventory"
  ON public.agency_inventory FOR DELETE USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_agency_inventory_updated_at
  BEFORE UPDATE ON public.agency_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
