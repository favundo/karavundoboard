ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS pret boolean DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS pret_utilisateur text DEFAULT null;
