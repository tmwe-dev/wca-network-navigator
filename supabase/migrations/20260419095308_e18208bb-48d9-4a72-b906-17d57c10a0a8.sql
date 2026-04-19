-- Rimuove trigger duplicato su channel_messages.
-- Esistevano DUE trigger AFTER INSERT che eseguivano on_inbound_message():
--   1. trg_inbound_message (vecchio, senza WHEN — eseguiva su ogni insert, anche outbound)
--   2. trg_on_inbound_message (nuovo, con WHEN direction='inbound')
-- Manteniamo solo il secondo, che è quello canonico.
DROP TRIGGER IF EXISTS trg_inbound_message ON public.channel_messages;