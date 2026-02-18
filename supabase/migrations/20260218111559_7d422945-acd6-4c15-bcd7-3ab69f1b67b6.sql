
-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT DEFAULT '',
  pseudo TEXT DEFAULT '',
  nom TEXT NOT NULL DEFAULT '',
  uid TEXT DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'portable',
  asset TEXT NOT NULL DEFAULT '',
  sn TEXT DEFAULT '',
  dns TEXT DEFAULT '',
  absence BOOLEAN DEFAULT false,
  remarques TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Public policies (internal dashboard, no auth required)
CREATE POLICY "Public read inventory" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Public insert inventory" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update inventory" ON public.inventory_items FOR UPDATE USING (true);
CREATE POLICY "Public delete inventory" ON public.inventory_items FOR DELETE USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
