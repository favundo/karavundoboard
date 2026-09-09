-- Numéro de ticket RT rattaché à une intervention du planning support.
--
-- Colonne nullable en base à dessein : les rendez-vous antérieurs au 09/09/2026
-- n'en portent aucun, et un NOT NULL sans valeur de repli les rendrait
-- impossibles à relire ou forcerait un faux numéro par défaut. L'obligation est
-- portée par le formulaire de prise de rendez-vous, où elle a un sens.
alter table support_appointments
  add column if not exists ticket_rt text;
