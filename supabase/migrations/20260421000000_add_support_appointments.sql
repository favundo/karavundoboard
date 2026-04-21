CREATE TABLE support_appointments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  uid_user text NOT NULL,
  email_user text NOT NULL,
  uid_technicien text NOT NULL,
  service text NOT NULL,
  asset text NOT NULL,
  type_intervention text NOT NULL,
  date_rdv timestamptz NOT NULL,
  duree_minutes integer NOT NULL DEFAULT 60,
  statut text NOT NULL DEFAULT 'planifie',
  notes text,
  rappel_envoye boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
