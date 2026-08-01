-- Seed del prompt operativo "Email Groups Classifier" per il Prompt Lab.
-- Idempotente: se già esiste con stesso (user_id, context, name) lo aggiorna.
-- Segue lo Standard Professore Prompt: Identità / Obiettivo / Metodo (procedure)
-- / Guardrail (criteria) / Esempi.
INSERT INTO public.operative_prompts (
  user_id, name, context, objective, procedure, criteria, examples,
  tags, is_active, priority
)
SELECT
  p.user_id,
  'Email Groups Classifier',
  'classification',
  -- OBIETTIVO
  'Assegnare ogni indirizzo email mittente al gruppo più corretto fra quelli definiti dall''operatore in email_sender_groups, riducendo i gruppi (mai inventarli) e distinguendo i mittenti REALI con cui abbiamo rapporto operativo dai COLD OUTREACH / pitch commerciali non richiesti.',
  -- PROCEDURA (METODO)
  E'1. Leggi il contesto aziendale: TMWE / Find Air opera nel freight forwarding e logistica internazionale. Le controparti reali sono clienti spedizionieri, agenti di network (WCA), vettori, fornitori operativi, banche, autorità doganali, partner ricorrenti.\n\n2. Per ogni mittente analizza in ordine: dominio, display name, ultimi oggetti (pattern, lingua, tono), volume.\n\n3. Decidi il gruppo applicando questa gerarchia di significato:\n   a) Operativo / Clienti / Fornitori / Banca / Agenti = SOLO controparti reali con cui esiste già o sta nascendo un rapporto di lavoro su spedizioni, fatturazione, pagamenti, documenti, network. NON usare per chi ci propone qualcosa.\n   b) Cold Outreach / Vendor Pitch / Promo Commerciale = chi ci sta VENDENDO software, SaaS, lead generation, consulenza, marketing, automazioni, "soluzioni" non richieste. Pattern tipici nei subject: "No more <pain>", "Stop <pain>", "How much of your day…", "What if…", "Let''s chat", "Quick chat", "15 min call", "Following up", "Just checking in", "grow faster", "save X hours", "AI-powered", "automate your…", pitch di piattaforme "all-in-one", display name personale + dominio sconosciuto.\n   c) ADS / Newsletter / Social = comunicazioni mass-market, notifiche piattaforme social, newsletter di settore.\n   d) Spam / Social Spam = chiaramente indesiderato, phishing, mailing list mai sottoscritte.\n\n4. Se ESISTE un gruppo dedicato ai cold pitch (es. Cold_Outreach, Vendor_Pitch, Promo_Commerciale) usalo. Se NON esiste, restituisci suggested_group="uncategorized" — è meglio non classificare che classificare male come Operativo.\n\n5. Preferisci sempre gruppi ampi e operativi (commerciale, fornitori, clienti, banca, social) ai micro-segmenti geografici. Non creare sottogruppi tipo "clienti Francia" se esiste già "Clienti".\n\n6. Usa gli esempi reali già classificati dall''operatore (passati nel prompt utente) come mini-guida di stile e perimetro.',
  -- CRITERI (GUARDRAIL)
  E'- MAI classificare un cold pitch come Operativo / Clienti / Fornitori / Banca / Agenti.\n- MAI inventare gruppi nuovi: usa solo quelli passati nella lista FOLDERS / GRUPPI.\n- Confidence < 0.4 → suggested_group="uncategorized".\n- Se la lingua del subject è inglese commerciale generico ("logistics teams we talk to are tangled…") e il dominio non è una controparte conosciuta, è quasi sempre cold outreach.\n- Output SOLO via tool call, niente testo libero.',
  -- ESEMPI
  E'ESEMPIO 1 — Cold pitch travestito da operativo\nMittente: anna.s@pie-cyfer.com (display "Anna S")\nSubject: "No more babysitting logistics software" / "Let''s chat when you are ready"\nClassificazione corretta: Cold_Outreach (o Vendor_Pitch). NON Operativo: il dominio è sconosciuto, il subject è un pitch SaaS, parla di "logistics software" non di una spedizione concreta.\n\nESEMPIO 2 — Operativo vero\nMittente: operations@maersk.com\nSubject: "Booking confirmation MSKU1234567 / ETA Genova"\nClassificazione corretta: Operativo. Controparte reale (vettore globale), oggetto su spedizione concreta.\n\nESEMPIO 3 — Newsletter di settore\nMittente: news@aircargonews.net\nSubject: "Weekly air cargo digest"\nClassificazione corretta: Airline_News (o Newsletter). NON Operativo, NON Cold Outreach.\n\nESEMPIO 4 — Notifica social\nMittente: notifications-noreply@linkedin.com\nClassificazione corretta: Social_Notification. Mai Operativo.',
  ARRAY['classification','email-groups-classifier','OBBLIGATORIA'],
  true,
  100
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.email_sender_groups g WHERE g.user_id = p.user_id
)
ON CONFLICT DO NOTHING;

-- Per gli utenti che hanno già un prompt con stesso nome+context, aggiorna i campi
-- (rispetta la struttura esistente, niente DELETE).
UPDATE public.operative_prompts op
SET
  objective = EXCLUDED_VALUES.objective,
  procedure = EXCLUDED_VALUES.procedure,
  criteria  = EXCLUDED_VALUES.criteria,
  examples  = EXCLUDED_VALUES.examples,
  tags      = EXCLUDED_VALUES.tags,
  priority  = 100,
  is_active = true,
  updated_at = now()
FROM (
  SELECT
    'Assegnare ogni indirizzo email mittente al gruppo più corretto fra quelli definiti dall''operatore in email_sender_groups, riducendo i gruppi (mai inventarli) e distinguendo i mittenti REALI con cui abbiamo rapporto operativo dai COLD OUTREACH / pitch commerciali non richiesti.'::text AS objective,
    E'1. Leggi il contesto aziendale: TMWE / Find Air opera nel freight forwarding e logistica internazionale. Le controparti reali sono clienti spedizionieri, agenti di network (WCA), vettori, fornitori operativi, banche, autorità doganali, partner ricorrenti.\n\n2. Per ogni mittente analizza in ordine: dominio, display name, ultimi oggetti (pattern, lingua, tono), volume.\n\n3. Decidi il gruppo applicando questa gerarchia di significato:\n   a) Operativo / Clienti / Fornitori / Banca / Agenti = SOLO controparti reali con cui esiste già o sta nascendo un rapporto di lavoro su spedizioni, fatturazione, pagamenti, documenti, network. NON usare per chi ci propone qualcosa.\n   b) Cold Outreach / Vendor Pitch / Promo Commerciale = chi ci sta VENDENDO software, SaaS, lead generation, consulenza, marketing, automazioni, "soluzioni" non richieste. Pattern tipici nei subject: "No more <pain>", "Stop <pain>", "How much of your day…", "What if…", "Let''s chat", "Quick chat", "15 min call", "Following up", "Just checking in", "grow faster", "save X hours", "AI-powered", "automate your…", pitch di piattaforme "all-in-one", display name personale + dominio sconosciuto.\n   c) ADS / Newsletter / Social = comunicazioni mass-market, notifiche piattaforme social, newsletter di settore.\n   d) Spam / Social Spam = chiaramente indesiderato, phishing, mailing list mai sottoscritte.\n\n4. Se ESISTE un gruppo dedicato ai cold pitch (es. Cold_Outreach, Vendor_Pitch, Promo_Commerciale) usalo. Se NON esiste, restituisci suggested_group="uncategorized" — è meglio non classificare che classificare male come Operativo.\n\n5. Preferisci sempre gruppi ampi e operativi (commerciale, fornitori, clienti, banca, social) ai micro-segmenti geografici. Non creare sottogruppi tipo "clienti Francia" se esiste già "Clienti".\n\n6. Usa gli esempi reali già classificati dall''operatore (passati nel prompt utente) come mini-guida di stile e perimetro.'::text AS procedure,
    E'- MAI classificare un cold pitch come Operativo / Clienti / Fornitori / Banca / Agenti.\n- MAI inventare gruppi nuovi: usa solo quelli passati nella lista FOLDERS / GRUPPI.\n- Confidence < 0.4 → suggested_group="uncategorized".\n- Se la lingua del subject è inglese commerciale generico ("logistics teams we talk to are tangled…") e il dominio non è una controparte conosciuta, è quasi sempre cold outreach.\n- Output SOLO via tool call, niente testo libero.'::text AS criteria,
    E'ESEMPIO 1 — Cold pitch travestito da operativo\nMittente: anna.s@pie-cyfer.com (display "Anna S")\nSubject: "No more babysitting logistics software" / "Let''s chat when you are ready"\nClassificazione corretta: Cold_Outreach (o Vendor_Pitch). NON Operativo: il dominio è sconosciuto, il subject è un pitch SaaS, parla di "logistics software" non di una spedizione concreta.\n\nESEMPIO 2 — Operativo vero\nMittente: operations@maersk.com\nSubject: "Booking confirmation MSKU1234567 / ETA Genova"\nClassificazione corretta: Operativo. Controparte reale (vettore globale), oggetto su spedizione concreta.\n\nESEMPIO 3 — Newsletter di settore\nMittente: news@aircargonews.net\nSubject: "Weekly air cargo digest"\nClassificazione corretta: Airline_News (o Newsletter). NON Operativo, NON Cold Outreach.\n\nESEMPIO 4 — Notifica social\nMittente: notifications-noreply@linkedin.com\nClassificazione corretta: Social_Notification. Mai Operativo.'::text AS examples,
    ARRAY['classification','email-groups-classifier','OBBLIGATORIA']::text[] AS tags
) AS EXCLUDED_VALUES
WHERE op.name = 'Email Groups Classifier'
  AND op.context = 'classification';