-- Seed prompt operativo "conversation-summary" per ogni operatore.
-- Prompt narrativo standard "Professore" (5 sezioni) per generare il riassunto
-- relazione contatto da iniettare nei prompt AI inbound/outbound.
INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
SELECT
  p.user_id,
  'Conversation Summary — Riassunto Relazione Contatto',
  'conversation-summary',
  'Produrre un riassunto narrativo (max 800 caratteri) della relazione con un contatto leggendo gli ultimi messaggi cross-canale (email, WhatsApp, LinkedIn). Il summary serve come SOSTITUTO della lettura completa dello storico nei prompt AI downstream.',
  E'1. Leggi gli ultimi N messaggi forniti (cross-canale, ordinati cronologicamente).\n2. Identifica il filo conduttore: di cosa parlate, dove siete arrivati, qual è lo stato della trattativa.\n3. Distilla in 3-6 frasi: chi è il contatto (ruolo/azienda), cosa abbiamo fatto insieme (incontri, preventivi, fiere), ultima trattativa attiva, esito atteso/prossimo passo.\n4. Estrai 3-5 "last_exchanges" sintetici: data + canale + direzione + gist (max 120 char) per ogni messaggio chiave.\n5. Calcola metriche: response_rate (% nostre→risposte ricevute), avg_response_time_hours, dominant_sentiment (positive/neutral/negative/mixed), preferred_language (ISO 639-1).',
  E'- Sobrio, fattuale, senza speculazioni.\n- NON inventare incontri, preventivi o eventi non presenti nei messaggi.\n- NON nominare il contatto al posto del nostro CRM (usa ruolo se serve).\n- Se i messaggi sono pochi/generici, ammettilo: "Relazione iniziale, 2 scambi formali, nessuna trattativa in corso".\n- Lingua del summary = lingua dominante della corrispondenza.',
  E'ESEMPIO OK:\nconversation_summary: "Mario Rossi, ufficio acquisti Acme SRL (IT). Conosciuti a Transpotec 2025. Ha richiesto preventivo per 3 spedizioni mensili Italia→Spagna a febbraio, gli abbiamo mandato tariffario il 12/2. Risposta interlocutoria sui Lead Time, attende nostra controproposta. Tono cordiale, risponde entro 24h."\nlast_exchanges: [{date:"2026-02-15", channel:"email", direction:"inbound", gist:"chiede chiarimenti su lead time Madrid"}, ...]\n\nESEMPIO KO (vietato):\nconversation_summary: "Mario è un ottimo cliente che fattura tantissimo." (speculativo, non basato sui messaggi)',
  ARRAY['conversation-summary', 'inbound', 'context', 'professore', 'universale'],
  80,
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.operative_prompts op
  WHERE op.user_id = p.user_id AND op.context = 'conversation-summary'
);