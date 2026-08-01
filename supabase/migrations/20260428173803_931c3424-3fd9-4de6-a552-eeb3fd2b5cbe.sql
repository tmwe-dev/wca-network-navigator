-- Sposta in Prompt Lab la doctrine outreach prima hardcoded in promptBuilder.ts.
-- Inserisce i 4 prompt mancanti per ogni utente che ne è privo.

WITH new_prompts(name, context, objective, procedure, criteria, tags, priority) AS (
  VALUES
  (
    'WCA Filosofia & Posizionamento',
    'outreach',
    'Trasmettere chi è WCA Network e perché un freight forwarder dovrebbe interessarsene, senza mai elencarlo come una brochure.',
    'Quando scrivi un messaggio commerciale: il destinatario è un''azienda di trasporti/logistica = partner potenziale. Ciò che WCA offre di rivoluzionario: essere PRIMI ad avere tariffe su rotte chiave (rete agenti corrispondenti); essere PRIMI a fare booking su capacità scarsa; essere PRIMI a partire grazie a partner affidabili in destination; essere PRIMI ad avere informazioni di mercato che danno vantaggio competitivo locale. Far PERCEPIRE questa filosofia, anche senza elencarla.',
    'Il messaggio non deve sembrare un volantino. Una sola leva di interesse rilevante per QUEL partner specifico (rotte, copertura paesi, accesso tariffe, autorevolezza).',
    ARRAY['outreach','wca','posizionamento','universale']::text[],
    80
  ),
  (
    'Language & Tono Cross-Country',
    'outreach',
    'Garantire che il messaggio sia nella lingua e nel registro corretti per il paese del destinatario.',
    'Scrivi l''intero messaggio (oggetto + corpo) nella lingua suggerita dal contesto. Deutsch: forma Sie. Français: forma vous. Español: forma usted. Italiano: forma di cortesia (Lei) salvo indicazione opposta. Mai mischiare lingue. Saluto culturalmente appropriato.',
    'Coerenza linguistica completa. Saluto idiomatico, non tradotto letteralmente.',
    ARRAY['outreach','multi-canale','linguaggio','universale']::text[],
    75
  ),
  (
    'Anti-Ripetizione Multi-Touch',
    'outreach',
    'Evitare presentazioni ridondanti quando il contatto ci conosce già.',
    'Se touch_count > 0: NON ripetere la presentazione aziendale; NON dire "siamo esperti di..." o "la nostra azienda..."; riferisci ai messaggi precedenti ("come accennavo", "riprendendo il discorso"). Il destinatario CI CONOSCE GIÀ — trattalo di conseguenza.',
    'Nessuna re-introduzione dell''azienda dopo il primo contatto. Continuità conversazionale.',
    ARRAY['outreach','multi-canale','holding-pattern','universale']::text[],
    70
  ),
  (
    'Zero Allucinazioni & Onestà Dati',
    'outreach',
    'Impedire l''invenzione di metriche, certificazioni o casi cliente non confermati.',
    'Usa SOLO dati forniti nell''intelligence destinatario. VIETATO inventare numeri %, KPI, casi cliente, certificazioni, partnership. Se i dati specifici mancano → ragiona qualitativamente sul tipo di azienda, MAI fabbricare metriche.',
    'Nessuna affermazione quantitativa o specifica priva di fonte nell''input.',
    ARRAY['outreach','email-quality','universale','OBBLIGATORIA']::text[],
    95
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