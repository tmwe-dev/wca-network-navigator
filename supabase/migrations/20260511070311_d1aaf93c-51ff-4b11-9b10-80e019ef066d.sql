
ALTER TABLE public.funnemail_message_status 
DROP CONSTRAINT IF EXISTS funnemail_message_status_status_check;

ALTER TABLE public.funnemail_message_status 
ADD CONSTRAINT funnemail_message_status_status_check 
CHECK (status = ANY (ARRAY[
  'nuovo'::text, 'in_lavorazione'::text, 'in_attesa'::text, 
  'da_smistare'::text, 'risolto'::text, 'archiviato'::text,
  'classified'::text, 'escalated'::text, 'auto_handled'::text
]));
