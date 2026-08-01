WITH new_prompts(name, context, objective, procedure, criteria, tags, priority) AS (
  VALUES
  (
    'Email Domain Detection Rules',
    'classification',
    'Classificare il dominio funzionale di un''email inbound prima ancora della categoria specifica.',
    E'Classifica il dominio email come uno tra: \n- "operative": richieste preventivo, booking, tracking spedizioni, documentazione, tariffe, stato merce, ordini.\n- "administrative": fatture, pagamenti, solleciti, note di credito, estratti conto, verifiche contabili, ricevute.\n- "support": reclami, richieste assistenza, problemi tecnici, feedback servizio, errori sistema.\n- "internal": newsletter, notifiche sistema, comunicazioni interne, auto-reply di sistema, digest automati.\n- "commercial": prospect, lead, partnership, collaborazione nuova, follow-up commerciali.\n\nSe email_address ha un domain_type manuale (da email_address_rules), RISPETTALO come segnale primario.',
    'Un solo dominio scelto. Se domain_type è impostato manualmente, usalo.',
    ARRAY['classification','lead-status','email-quality','universale']::text[],
    85
  )
)
INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, tags, priority, is_active)
SELECT u.id, np.name, np.context, np.objective, np.procedure, np.criteria, np.tags, np.priority, true
FROM auth.users u
CROSS JOIN new_prompts np
WHERE NOT EXISTS (
  SELECT 1 FROM public.operative_prompts op
  WHERE op.user_id = u.id AND op.name = np.name
);