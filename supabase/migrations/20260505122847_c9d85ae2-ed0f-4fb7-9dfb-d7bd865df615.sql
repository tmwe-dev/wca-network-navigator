INSERT INTO public.email_sender_groups (user_id, nome_gruppo, colore, icon, sort_order, classification_hint)
SELECT 'ae35ad39-de57-45df-9d24-538cdbbd5e87'::uuid, x.nome, x.colore, x.icon, x.sort_order, x.hint
FROM (VALUES
  ('Quotazioni', '#F59E0B', '💰', 1, 'Richieste di tariffa, quote, RFQ, preventivi spedizione/servizio, listini, rates, cotation, freight quote.'),
  ('Operativa', '#10B981', '🚚', 1, 'Booking, tracking, ritiri, consegne, documenti shipment in corso, AWB, BL, customs, problemi operativi attivi.'),
  ('Consulenza', '#8B5CF6', '🤝', 1, 'Richieste di info commerciali, presentazioni aziendali, primi contatti, partnership, meeting requests, introduction.')
) AS x(nome, colore, icon, sort_order, hint)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_sender_groups g
  WHERE g.user_id = 'ae35ad39-de57-45df-9d24-538cdbbd5e87'::uuid
    AND lower(g.nome_gruppo) = lower(x.nome)
);

UPDATE public.email_sender_groups
SET funnemail_policy = COALESCE(funnemail_policy, '{}'::jsonb) || '{"auto_mark_read": true}'::jsonb
WHERE user_id = 'ae35ad39-de57-45df-9d24-538cdbbd5e87'::uuid
  AND nome_gruppo IN ('ADS','Newsletter','Freight_Newsletter','Social_News','Social_Notification','AIrline_News','TRADE_SHOW','EVENTS','Social Spam','Spam');