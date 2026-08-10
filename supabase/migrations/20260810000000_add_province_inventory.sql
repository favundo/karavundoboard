-- Groupes Province inventory: new table mirroring inventory_items,
-- holding assets of the province platforms (Lille & Nantes).

-- 1. Table (full mirror of inventory_items current schema)
CREATE TABLE IF NOT EXISTS public.province_inventory (
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
  windows_version TEXT DEFAULT '',
  eset_app TEXT DEFAULT '',
  pret BOOLEAN DEFAULT false,
  pret_utilisateur TEXT DEFAULT NULL,
  warranty_end_date DATE DEFAULT NULL,
  warranty_duration INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Unique constraint on asset (required by PostgREST upsert onConflict)
ALTER TABLE public.province_inventory DROP CONSTRAINT IF EXISTS province_inventory_asset_unique;
ALTER TABLE public.province_inventory ADD CONSTRAINT province_inventory_asset_unique UNIQUE (asset);

-- 3. RLS + public policies (internal dashboard, no auth)
ALTER TABLE public.province_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read province" ON public.province_inventory;
DROP POLICY IF EXISTS "Public insert province" ON public.province_inventory;
DROP POLICY IF EXISTS "Public update province" ON public.province_inventory;
DROP POLICY IF EXISTS "Public delete province" ON public.province_inventory;
CREATE POLICY "Public read province" ON public.province_inventory FOR SELECT USING (true);
CREATE POLICY "Public insert province" ON public.province_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update province" ON public.province_inventory FOR UPDATE USING (true);
CREATE POLICY "Public delete province" ON public.province_inventory FOR DELETE USING (true);

-- 4. updated_at trigger (reuses existing public.update_updated_at_column())
DROP TRIGGER IF EXISTS update_province_inventory_updated_at ON public.province_inventory;
CREATE TRIGGER update_province_inventory_updated_at
  BEFORE UPDATE ON public.province_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Move existing province assets from inventory_items → province_inventory
INSERT INTO public.province_inventory (
  id, matricule, pseudo, nom, uid, service, type, asset, sn, dns,
  absence, remarques, windows_version, eset_app, pret, pret_utilisateur,
  warranty_end_date, warranty_duration, created_at, updated_at
)
SELECT
  id, matricule, pseudo, nom, uid, service, type, asset, sn, dns,
  absence, remarques, windows_version, eset_app, pret, pret_utilisateur,
  warranty_end_date, warranty_duration, created_at, updated_at
FROM public.inventory_items
WHERE service IN ('Groupes - Plateforme Lille', 'Groupes - Plateforme Nantes')
ON CONFLICT (asset) DO NOTHING;

DELETE FROM public.inventory_items
WHERE service IN ('Groupes - Plateforme Lille', 'Groupes - Plateforme Nantes');

-- 6. Allow 'province' as a decommission source
ALTER TABLE public.decommissioned_items
  DROP CONSTRAINT IF EXISTS decommissioned_items_source_check;
ALTER TABLE public.decommissioned_items
  ADD CONSTRAINT decommissioned_items_source_check
  CHECK (source IN ('siege', 'province', 'agences', 'abcroisiere', 'stock'));
