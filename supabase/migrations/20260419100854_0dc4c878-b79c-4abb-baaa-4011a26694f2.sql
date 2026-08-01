-- Migra eventuali valori obsoleti PRIMA del constraint
UPDATE public.prospects SET lead_status = 'first_touch_sent' WHERE lead_status = 'contacted';
UPDATE public.prospects SET lead_status = 'engaged' WHERE lead_status = 'qualified';
UPDATE public.prospects SET lead_status = 'archived' WHERE lead_status = 'lost';
UPDATE public.prospects SET lead_status = 'engaged' WHERE lead_status = 'in_progress';

-- Drop di eventuale constraint con nome standard, poi aggiunge i 9 stati canonici
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_lead_status_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_lead_status_check
  CHECK (lead_status IN ('new','first_touch_sent','holding','engaged','qualified','negotiation','converted','archived','blacklisted'));