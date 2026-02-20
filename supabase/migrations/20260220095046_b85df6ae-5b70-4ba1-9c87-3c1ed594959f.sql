-- Create ABcroisière inventory table (same structure as inventory_items)
CREATE TABLE public.abcroisiere_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL DEFAULT '',
  uid TEXT DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'portable',
  asset TEXT NOT NULL DEFAULT '',
  sn TEXT DEFAULT '',
  dns TEXT DEFAULT '',
  absence BOOLEAN DEFAULT false,
  matricule TEXT DEFAULT '',
  pseudo TEXT DEFAULT '',
  remarques TEXT DEFAULT '',
  windows_version TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.abcroisiere_inventory ENABLE ROW LEVEL SECURITY;

-- Public access policies (same as inventory_items)
CREATE POLICY "Public read abcroisiere inventory"
  ON public.abcroisiere_inventory FOR SELECT USING (true);

CREATE POLICY "Public insert abcroisiere inventory"
  ON public.abcroisiere_inventory FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update abcroisiere inventory"
  ON public.abcroisiere_inventory FOR UPDATE USING (true);

CREATE POLICY "Public delete abcroisiere inventory"
  ON public.abcroisiere_inventory FOR DELETE USING (true);

-- Auto-update updated_at trigger
CREATE TRIGGER update_abcroisiere_inventory_updated_at
  BEFORE UPDATE ON public.abcroisiere_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
