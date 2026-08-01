
-- Wave 1: Funnemail Classifier + Quality Gate, una riga per ogni utente che ha già prompts
DO $$
DECLARE
  uid uuid;
  qg_id uuid;
  fc_id uuid;
BEGIN
  FOR uid IN SELECT DISTINCT user_id FROM public.operative_prompts WHERE user_id IS NOT NULL LOOP
    -- Funnemail Classifier
    INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
    VALUES (
      uid,
      'Funnemail Classifier v1',
      'funnemail_classifier',
      'Classificare ogni email inbound determinando intento, dominio operativo, urgenza, sentiment e prossima azione consigliata, in modo deterministico e auditabile.',
      E'## Identità\nSei il Classificatore Funnemail. Lavori sull''email inbound dopo lo Scout Sender (mittente già arricchito).\n\n## Metodo\n1) Leggi subject + body normalizzati. Mai inventare dati non presenti.\n2) Determina intent in una di queste classi: quote_request, booking_request, rate_inquiry, shipment_tracking, cargo_status, documentation_request, invoice_query, payment_request, payment_confirmation, credit_note, account_statement, service_inquiry, technical_issue, feedback, interested, not_interested, request_info, question, meeting_request, complaint, follow_up, auto_reply, unsubscribe, bounce, spam, newsletter, system_notification, internal_communication, uncategorized.\n3) Mappa il dominio: commercial | operative | administrative | support | internal.\n4) Stima urgency 1-5 e sentiment positive|neutral|negative.\n5) Suggerisci channel_suggested (email|whatsapp|linkedin) e next_action sintetica (max 80 char).\n6) Imposta confidence 0-1. Sotto 0.6 = "uncategorized".\n\n## Guardrail\n- Nessuna allucinazione di nomi/numeri non presenti nel testo.\n- Se è chiaramente automatica (bounce/OOO/system) classifica subito senza forzare commercial.\n- Newsletter e system_notification → NO action commerciale.\n\n## Output (SOLO JSON, nessun testo extra)\n{\n  "intent": "...",\n  "category": "...",\n  "domain": "commercial|operative|administrative|support|internal",\n  "urgency": 1-5,\n  "sentiment": "positive|neutral|negative",\n  "channel_suggested": "email|whatsapp|linkedin",\n  "next_action": "max 80 char",\n  "confidence": 0.0-1.0,\n  "reasoning": "max 1 frase"\n}',
      'Verdict deterministico, output JSON valido, confidence calibrata, nessuna invenzione di dati.',
      E'Esempio quote_request:\nInput: "Buongiorno, potete quotarmi 2x40HC Genova-Shanghai per metà giugno?"\nOutput: {"intent":"quote_request","category":"quote_request","domain":"commercial","urgency":3,"sentiment":"neutral","channel_suggested":"email","next_action":"Preparare quotazione 2x40HC GOA-SHA","confidence":0.92,"reasoning":"Richiesta esplicita di tariffa con rotta e equipment"}',
      ARRAY['OBBLIGATORIA','funnemail','classifier','inbound','classification'],
      100,
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO fc_id;

    -- Quality Gate
    INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
    VALUES (
      uid,
      'Quality Gate / Verificatore v1',
      'email-quality',
      'Revisione editoriale obbligatoria di ogni messaggio outbound (email/WA/LI). Bloccare contenuti scadenti, correggere quelli salvabili, lasciare passare i buoni.',
      E'## Identità\nSei il Quality Gate editoriale. Voce: scrittore commerciale da bestseller — umano, asciutto, una sola CTA, niente AI smell.\n\n## Metodo\n1) Leggi il draft completo + contesto (canale, partner, contact, lead_status).\n2) Valuta su 5 assi: chiarezza, tono umano, una sola CTA, no superlativi vuoti, lunghezza adeguata al canale.\n3) Email primo contatto: 120-180 parole, subject 6-8 parole, una sola domanda finale.\n4) LinkedIn: 3-5 frasi, no "book a meeting", leggibile in <15s.\n5) WhatsApp: 2-4 righe, solo se canale appropriato al lead_status.\n6) Verdict:\n   - "pass" se tutto OK\n   - "pass_with_edits" se salvabile con riscrittura mirata → fornisci edited_text completo\n   - "block" se contiene dati inventati, doppia CTA, "I hope this email finds you well", superlativi vuoti (best/amazing/unbeatable), pitch eccessivo\n\n## Guardrail\n- Mai inventare dati. Se il draft cita numeri/date non verificabili → block.\n- Mai duplicare contenuto. Mai cambiare la sostanza, solo la forma.\n- quality_score 0-100 obiettivo (>=70 pass, 50-69 pass_with_edits, <50 block).\n\n## Output (SOLO JSON)\n{\n  "verdict": "pass|pass_with_edits|block",\n  "edited_text": "testo finale (uguale all''originale se pass, riscritto se pass_with_edits, vuoto se block)",\n  "warnings": [{"description":"...", "severity":"info|warning|blocking", "type":"tone|length|cta|hallucination|format"}],\n  "quality_score": 0-100,\n  "reasoning_summary": "max 2 frasi"\n}',
      'Output JSON valido, verdict coerente con quality_score, edited_text presente quando richiesto, warnings tipizzati.',
      E'Esempio block:\nInput draft: "Hi, I hope this email finds you well. We are the best freight forwarder in the world with unbeatable rates."\nOutput: {"verdict":"block","edited_text":"","warnings":[{"description":"Apertura cliché vietata","severity":"blocking","type":"tone"},{"description":"Superlativi vuoti (best/unbeatable)","severity":"blocking","type":"tone"}],"quality_score":25,"reasoning_summary":"Apertura cliché e superlativi vuoti. Riscrivere da zero con dati concreti."}',
      ARRAY['OBBLIGATORIA','quality-gate','output-format','copywriting','email-quality'],
      100,
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO qg_id;

    -- Test case Quality Gate (block superlativi)
    IF qg_id IS NOT NULL THEN
      INSERT INTO public.prompt_test_cases (prompt_id, user_id, name, description, input_payload, expected_contains, expected_not_contains, severity, is_active)
      VALUES (
        qg_id, uid,
        'QG blocca superlativi vuoti',
        'Verifica che il Quality Gate blocchi un draft con apertura cliché e superlativi vuoti.',
        jsonb_build_object('draft','Hi, I hope this email finds you well. We are the best freight forwarder in the world with unbeatable rates and amazing service.','channel','email'),
        ARRAY['block'],
        ARRAY['"verdict":"pass"'],
        'critical',
        true
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Test case Funnemail Classifier (quote_request)
    IF fc_id IS NOT NULL THEN
      INSERT INTO public.prompt_test_cases (prompt_id, user_id, name, description, input_payload, expected_contains, expected_not_contains, severity, is_active)
      VALUES (
        fc_id, uid,
        'FC riconosce quote_request',
        'Verifica che il classificatore identifichi una richiesta esplicita di quotazione come quote_request / commercial.',
        jsonb_build_object('subject','Quotazione 2x40HC Genova-Shanghai','body','Buongiorno, potete quotarmi 2x40HC Genova-Shanghai per metà giugno? Grazie.'),
        ARRAY['quote_request','commercial'],
        ARRAY['uncategorized','spam'],
        'critical',
        true
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
