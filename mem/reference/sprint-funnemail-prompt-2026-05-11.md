---
name: Sprint Funnemail + Prompt Hardening 2026-05-11
description: Sprint Codex; deduplicato funnemail_classifier (3→1), pilot Funnemail su Amministrativo+FORNITORI, UNIQUE INDEX anti-duplicato, ai_interaction_log esteso con edge_ai
type: reference
---
Sprint 1.1 ✅ funnemail_classifier: 3 nomi → 1 ("Funnemail Classifier v1") per 6 utenti. Le altre 2 varianti `is_active=false` + tag `deprecated_2026_05_11`.
Sprint 1.2 ✅ classification/email/email-quality/outreach = layer compositivi legittimi (no dedup).
Sprint 1.3 ✅ UNIQUE INDEX `operative_prompts_active_unique_idx (user_id, context, name) WHERE is_active`.
Sprint 2.1 ✅ Pilot Funnemail su `Amministrativo` + `FORNITORI`: policy `{tag_only, crm_update}`, min_confidence 0.6, pilot=true.
Sprint 2.2 ✅ Real-time già wired in `classify-inbound-message → dispatchFunnemail`.
Sprint 3.1 ✅ `ai_interaction_log.interaction_type` accetta `edge_ai`; DAL TS + UI aggiornati.
Stato Sprint 4: personas 8, capabilities 45, test_cases 17 ✅; agent_routing_rules ancora 0.
