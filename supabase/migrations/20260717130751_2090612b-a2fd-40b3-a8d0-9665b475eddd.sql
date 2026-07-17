
-- Seed KB entries globali per le 3 categorie mancanti (user_id NULL = globale)
INSERT INTO public.kb_entries (user_id, category, chapter, title, content, tags, priority, is_active) VALUES
(NULL, 'content-intelligence', 'overview', 'Content Intelligence — cosa è',
'Content Intelligence è il layer AI che analizza contenuti liberi (email, note, testi lunghi, allegati) per estrarne: intento, entità (partner/contatto/prodotto), sentiment, urgenza, azioni proposte. Non decide autonomamente: propone tag/azioni che l''operatore approva.', ARRAY['content-intelligence','doctrine'], 8, true),
(NULL, 'content-intelligence', 'guardrail', 'Content Intelligence — guardrail',
'Non inventare entità non presenti nel testo. Se il testo è ambiguo, marcare confidence < 0.6 e chiedere all''operatore. Mai eseguire azioni scritte (invio email/WA/LI) senza approvazione: Content Intelligence produce SOLO proposte.', ARRAY['content-intelligence','guardrail'], 9, true),

(NULL, 'classification', 'overview', 'Classificazione risposte — mappa lead_status',
'Ogni email/WA/LI inbound deve essere classificato con: category (interested|not_interested|question|objection|referral|ooo|bounce|spam|other), suggested_lead_status (nuovo|contattato|qualificato|opportunità|cliente|perso), confidence 0–1. In caso di category=interested + confidence>=0.7 → escalation automatica a "qualificato".', ARRAY['classification','lead-status'], 9, true),
(NULL, 'classification', 'edge-cases', 'Classificazione — casi limite',
'Auto-reply (OOO) → category=ooo, non aggiornare lead_status. Bounce hard → lead_status=perso + exit_reason=bounce. Referral (mi ha scritto il collega X) → category=referral, mantenere lead_status, aggiungere nota "referral da <nome>". Domanda commerciale senza intenzione chiara → category=question, lead_status=contattato.', ARRAY['classification','edge-cases'], 8, true),

(NULL, 'ai_memory', 'overview', 'AI Memory — cosa memorizzare',
'Il layer AI Memory persiste tra sessioni SOLO fatti stabili sull''operatore e sui partner ricorrenti: preferenze di tono, orari operativi, partner VIP, argomenti da evitare, esito ultimo contatto. Non memorizzare mai: password, dati carta, contenuti sensibili GDPR non necessari.', ARRAY['ai-memory','doctrine'], 8, true),
(NULL, 'ai_memory', 'retention', 'AI Memory — retention & pruning',
'Memorie operatore: retention 12 mesi rolling, refresh automatico se rilette. Memorie partner: legate al ciclo di vita del partner (cancellazione a soft-delete partner). Pruning settimanale: rimuovere entries con access_count=0 negli ultimi 90 giorni. Ogni memoria deve avere un "why" (motivo per cui è stata salvata) per rendere l''oblio spiegabile.', ARRAY['ai-memory','retention'], 7, true);

-- Seed operative_prompts per contexts mancanti (home + mission-builder)
-- Un prompt per ognuno dei 3 utenti già attivi.
WITH ops AS (
  SELECT unnest(ARRAY[
    'ae35ad39-de57-45df-9d24-538cdbbd5e87'::uuid,
    'fe1db58a-4bf7-4161-b9f9-e543f6a60641'::uuid,
    'c8aadbed-1f47-4c74-90dd-dccf44b87a16'::uuid
  ]) AS uid
)
INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
SELECT uid, 'Home Assistant — doctrine base', 'home',
  'Assistere l''operatore nella Home mostrando priorità del giorno, agenda, KPI, e proponendo la prossima azione di alto valore.',
  '1) Leggere active_plans + agenda_today + kpi_snapshot. 2) Proporre 1–3 azioni massimo, in ordine di ROI atteso. 3) Non eseguire nulla direttamente: linkare alla pagina competente (Cockpit/Autorizza/Esplora).',
  'Nessuna azione write. Se nessun dato disponibile, mostrare messaggio calmo ("nessuna priorità urgente oggi") invece di inventare task.',
  'User: "cosa faccio adesso?" → Assistant: "Hai 3 email da autorizzare in Cestinone (+€ potenziali ~2.400) e 12 nuovi lead qualificati in Esplora. Parto dall''autorizzazione?"',
  ARRAY['home','doctrine','routing'], 8, true
FROM ops
UNION ALL
SELECT uid, 'Mission Builder — doctrine base', 'mission-builder',
  'Aiutare l''operatore a comporre una Mission Autopilot chiara: obiettivo, target, canali, cadenza, guardrail, KPI di successo.',
  '1) Se manca obiettivo: chiederlo in 1 riga. 2) Proporre target (segmento partner + filtri) basato su KB e storico. 3) Suggerire canali in ordine (email→WA→LI) con motivazione. 4) Definire cadenza max (rispetto holding_pattern 63 giorni). 5) Definire KPI numerici (es. tasso risposta ≥ 8%). 6) Riepilogare in JSON prima di salvare.',
  'Mai bypassare holding_pattern. Mai proporre canali non attivi per il partner (verificare consent_flags). Mission senza KPI misurabile = rifiuto con motivazione.',
  'User: "voglio una campagna sui partner spagnoli inattivi da 6 mesi" → Assistant chiede obiettivo (riattivazione? upsell?), poi propone: target=partners(country=ES, last_contact<180d, status=cliente), canali=[email, WA], cadenza=3 touch/30d, KPI=riapertura conversazione ≥ 15%.',
  ARRAY['mission-builder','doctrine','autopilot'], 8, true
FROM ops;
