-- 1) Crea gruppo Cold_Outreach (uno solo, visibile a tutti via RLS condivisa).
INSERT INTO public.email_sender_groups (user_id, nome_gruppo, descrizione, colore, icon, classification_hint, response_style_hint, sort_order, is_default)
SELECT (SELECT user_id FROM public.email_sender_groups WHERE lower(nome_gruppo)='operativo' LIMIT 1),
       'Cold_Outreach',
       'Pitch commerciali a freddo, demo, lead gen, growth manager, agenzie SaaS o logistica che ci scrivono per la prima volta SENZA un riferimento operativo (no spedizione, no AWB/MAWB/B/L, no booking, no preventivo richiesto, no thread esistente).',
       '#9CA3AF',
       '📨',
       'Mittente sconosciuto + tono pitch/sales + nessun riferimento a spedizione/AWB/MAWB/B/L/booking/fattura/dogana/thread esistente. Anche se parla di logistica resta Cold_Outreach finché non c''è un riferimento operativo concreto.',
       'Risposta secca, professionale, nessun impegno. Non sollevare attese commerciali.',
       95,
       false
WHERE NOT EXISTS (SELECT 1 FROM public.email_sender_groups WHERE lower(nome_gruppo)='cold_outreach');

-- 3) Indurisce il guardrail "Operativo" nel prompt Inbound Triage TMWE per
--    tutte le copie (una per utente).
UPDATE public.operative_prompts
SET procedure = replace(
      procedure,
      '# GUARDRAIL'||chr(10)||'- Non inventare urgenza dove non c''è (newsletter, OOO, statement mensile = bassa).',
      '# GUARDRAIL'||chr(10)||
      '- **Operativo richiede riferimento esplicito** a una spedizione, booking, AWB/MAWB/B/L, fattura, pagamento, dogana, statement, oppure è una risposta a un thread esistente. Se manca → MAI business_category=operations o administrative, anche se il testo parla di logistica/freight in astratto. In quel caso usa commercial_demand (se richiesta vera) oppure commercial_supply / newsletter / Cold_Outreach.'||chr(10)||
      '- Pitch a freddo / growth manager / demo / "we help logistics companies…" senza riferimento operativo concreto → SEMPRE commercial_supply o noise (suggested group: Cold_Outreach), MAI operations.'||chr(10)||
      '- Non inventare urgenza dove non c''è (newsletter, OOO, statement mensile = bassa).'
    ),
    updated_at = now()
WHERE context = 'classification'
  AND name = 'Inbound Triage TMWE'
  AND deprecated_at IS NULL
  AND procedure NOT LIKE '%Operativo richiede riferimento esplicito%';