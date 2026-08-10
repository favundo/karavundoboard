-- Imprimantes Siège : nouvelle table d'inventaire des imprimantes.

CREATE TABLE IF NOT EXISTS public.printer_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL DEFAULT '',
  modele TEXT DEFAULT '',
  mac TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  fabricant TEXT DEFAULT '',
  hostname TEXT DEFAULT '',
  sn TEXT DEFAULT '',
  service TEXT DEFAULT '',
  emplacement TEXT DEFAULT '',
  date_enregistrement DATE DEFAULT NULL,
  warranty_duration INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_inventory DROP CONSTRAINT IF EXISTS printer_inventory_asset_unique;
ALTER TABLE public.printer_inventory ADD CONSTRAINT printer_inventory_asset_unique UNIQUE (asset);

ALTER TABLE public.printer_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read printer" ON public.printer_inventory;
DROP POLICY IF EXISTS "Public insert printer" ON public.printer_inventory;
DROP POLICY IF EXISTS "Public update printer" ON public.printer_inventory;
DROP POLICY IF EXISTS "Public delete printer" ON public.printer_inventory;
CREATE POLICY "Public read printer" ON public.printer_inventory FOR SELECT USING (true);
CREATE POLICY "Public insert printer" ON public.printer_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update printer" ON public.printer_inventory FOR UPDATE USING (true);
CREATE POLICY "Public delete printer" ON public.printer_inventory FOR DELETE USING (true);

DROP TRIGGER IF EXISTS update_printer_inventory_updated_at ON public.printer_inventory;
CREATE TRIGGER update_printer_inventory_updated_at
  BEFORE UPDATE ON public.printer_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.printer_inventory
  (asset, modele, mac, ip, fabricant, hostname, sn, service, emplacement, date_enregistrement, warranty_duration)
VALUES
  ('17718', 'WF-C579R Series', 'F8:25:51:9B:50:34', '10.12.3.129', 'EPSON', 'print17718.in.karavel.com', 'X576078473', '20-2eme-paye', 'Paris Siege', '2022-12-28', 3),
  ('17720', 'WF-C579R Series', 'F8:25:51:9B:C8:91', '10.12.3.136', 'EPSON', 'print17720.in.karavel.com', 'X576081131', '20-2eme-recrutement', 'Paris Siege', '2022-12-29', 3),
  ('13832', 'AM-C6000 Series', '64:C6:D2:64:95:9B', '10.12.3.139', 'EPSON', 'print13832.in.karavel.com', 'XAVG001343', '17-1er-GTO', 'Paris Siege', '2024-07-16', 3),
  ('30091', 'EM-C800 Series', 'A4:D7:3C:72:0E:52', '10.12.3.144', 'EPSON', 'print30091.in.karavel.com', 'XCUX014672', '20 6e SSI / BO-IT', 'Paris Siège', '2025-03-31', 3),
  ('30193', 'EM-C800 Series', 'A4:D7:3C:72:0E:54', '10.12.3.145', 'EPSON', 'print30193.in.karavel.com', 'XCUX014712', '17 4e droite  CDG', 'Paris Siège', '2025-07-07', 3),
  ('17724', 'WF-C579R Series', 'F8:25:51:9B:C9:4E', '10.12.3.155', 'EPSON', 'print17724.in.karavel.com', 'X576081155', '17-3eme-Juridique', 'Paris Siege', '2022-12-29', 3),
  ('17683', 'WF-C879R Series', '38:9D:92:E1:5F:E4', '10.12.3.160', 'EPSON', 'print17683.in.karavel.com', 'X6GN012026', '17-1er-Yield', 'Paris Siege', '2022-09-21', 3),
  ('17656', 'WF-C579R Series', 'DC:CD:2F:A3:7E:21', '10.12.3.161', 'EPSON', 'print17656.in.karavel.com', 'X576063807', '17-3eme-Ebooking', 'Paris Siege', '2022-09-21', 3),
  ('17657', 'WF-C579R Series', 'DC:CD:2F:A3:7D:96', '10.12.3.162', 'EPSON', 'print17657.in.karavel.com', 'X576063910', '17-2eme-Market', 'Paris Siege', '2022-09-21', 3),
  ('17660', 'WF-C579R Series', 'DC:CD:2F:A3:7D:73', '10.12.3.163', 'EPSON', 'print17660.in.karavel.com', 'X576063994', '17-4eme-Frontoffice', 'Paris Siege', '2022-09-21', 3),
  ('17661', 'WF-C20750 Series', '38:9D:92:FF:B9:26', '10.12.3.164', 'EPSON', 'Print17661.in.karavel.com', 'X754003079', '17-BatD-4-Finance', 'Paris Siege', '2022-09-21', 3),
  ('17662', 'WF-C20750 Series', '38:9D:92:FF:B9:22', '10.12.3.165', 'EPSON', 'print17662.in.karavel.com', 'X754003075', '20-2eme-RH', 'Paris Siege', '2022-09-21', 3),
  ('17685', 'WF-C879R Series', '38:9D:92:E1:60:72', '10.12.3.168', 'EPSON', 'print17685.in.karavel.com', 'X6GN012077', '20-5eme-Groupes', 'Paris Siege', '2022-09-21', 3),
  ('17687', 'WF-C879R Series', '38:9D:92:E1:5F:E8', '10.12.3.170', 'EPSON', 'print17687.in.karavel.com', 'X6GN012039', '21-RDC-Facturation', 'Paris Siege', '2022-09-21', 3),
  ('17719', 'WF-C579R Series', 'F8:25:51:9B:CB:45', NULL, 'EPSON', 'print17719.in.karavel.com', 'X576081123', '17-rdc-sg', 'Paris Siege', '2022-12-28', 3),
  ('17760', 'WF-C579R Series', 'DC:CD:2F:A2:5C:2F', '10.12.3.171', 'EPSON', 'print17760.in.karavel.com', 'X576058845', '21-1er-CRM', 'Paris Siege', '2023-05-11', 3),
  ('17710', 'WF-C579R Series', 'F8:25:51:9B:CB:AF', '10.12.3.172', 'EPSON', 'print17710.in.karavel.com', 'X576081264', '17-1er-cyrille', 'Paris Siege', '2022-12-28', 3),
  ('17721', 'WF-C579R Series', 'F8:25:51:9B:C8:7F', '10.12.3.173', 'EPSON', 'print17721.in.karavel.com', 'X576081091', '21-rdc-bo-it', 'Paris Siege', '2022-12-29', 3),
  ('17715', 'WF-C579R Series', 'F8:25:51:9B:CB:01', '10.12.3.174', 'EPSON', 'print17715.in.karavel.com', 'X576081162', '17-4eme-operations', 'Paris Siege', '2022-12-29', 3),
  ('17723', 'WF-C579R Series', 'F8:25:51:9B:C9:4F', '10.12.3.175', 'EPSON', 'print17723.in.karavel.com', 'X576081157', '21-rdc-bo-sup', 'Paris Siege', '2022-12-29', 3),
  ('17712', 'WF-C579R Series', 'F8:25:51:9B:CB:B0', '10.12.3.176', 'EPSON', 'print17712.in.karavel.com', 'X576081262', '21-RDC-Accueil', 'Paris Siege', '2022-12-29', 3),
  ('17717', 'WF-C579R Series', 'F8:25:51:9B:57:18', '10.12.3.177', 'EPSON', 'print17717.in.karavel.com', 'X576078646', '21-1er-Agences', 'Paris Siege', '2022-12-29', 3),
  ('17725', 'WF-C579R Series', 'DC:CD:2F:A2:5B:5A', '10.12.3.179', 'EPSON', 'print17725.in.karavel.com', 'X576058822', '20-4eme-Folco', 'Paris Siege', '2022-12-29', 3),
  ('17713', 'WF-C579R Series', 'F8:25:51:9B:C9:69', '10.12.3.180', 'EPSON', 'print17713.in.karavel.com', 'X576081161', '20-4eme-prod4', 'Paris Siege', '2022-12-29', 3),
  ('17711', 'WF-C579R Series', 'F8:25:51:9B:C9:7A', '10.12.3.183', 'EPSON', 'print17711.in.karavel.com', 'X576081271', '20-4EME-Amadeus', 'Paris Siege', '2022-12-29', 3),
  ('17726', 'WF-C579R Series', 'DC:CD:2F:A2:5B:5C', '10.12.3.189', 'EPSON', 'print17726.in.karavel.com', 'X576058818', '20-3eme-sysadmin', 'Paris Siege', '2022-12-29', 3),
  ('17714', 'WF-C579R Series', 'F8:25:51:9B:C9:68', '10.12.3.195', 'EPSON', 'print17714.in.karavel.com', 'X576081159', '21-1er-Ecoutes', 'Paris Siege', '2022-12-29', 3),
  ('17809', 'WF-C579R Series', 'DC:CD:2F:A2:5B:28', '10.12.3.196', 'EPSON', 'print17809.in.karavel.com', 'X576058761', '17-3eme-Data', 'Paris Siege', '2024-09-23', 3),
  ('17716', 'WF-C579R Series', 'F8:25:51:9B:C9:3A', '10.12.3.32', 'EPSON', 'print17716.in.karavel.com', 'X576081164', 'SG', 'Paris Siege', '2023-08-11', 3),
  ('13915', 'AM-C4000 Series', '64:C6:D2:64:81:33', '10.12.3.44', 'EPSON', 'Print13915.in.karavel.com', 'XAUV005769', '17-4eme-formation', 'Paris Siege', '2024-10-29', 3)
ON CONFLICT (asset) DO NOTHING;
