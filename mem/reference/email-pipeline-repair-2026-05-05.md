---
name: Email Pipeline Repair 2026-05-05
description: Audit + riparazione pipeline analisi email — dedup 20 prompt, attivazione classify-inbound-message via pg_net dal trigger on_inbound_message, rimozione reply-classifier legacy
type: feature
---

## Cosa è stato riparato (codex CRITICAL)

1. **Dedup operative_prompts**: 20 duplicati su context `classification`+`content-intelligence` soft-deprecati (deprecated_at + deprecated_reason='auto-dedup 2026-05-05'). Risultato: 6 prompt unici attivi. Rollback: `UPDATE operative_prompts SET deprecated_at=NULL WHERE deprecated_reason LIKE 'auto-dedup 2026-05-05%'`.
2. **Trigger `on_inbound_message` ATTIVA classify-inbound-message** via `net.http_post` fail-safe (skip se v_skip_activity true). Logica esistente (outreach replied, contact lookup, activities insert, filtri newsletter) immutata.
3. **`reply-classifier` rimosso** (legacy, sostituito da classify-inbound-message, zero callsite).

## Pipeline runtime corrente
- INBOUND email/WA/LI inserita in `channel_messages` → trigger `on_inbound_message`:
  - aggiorna outreach_queue + activities (legacy, immutato)
  - chiama `classify-inbound-message` (v2) fire-and-forget se non newsletter
- `classify-inbound-message` orchestra (solo email): `funnemail-scout-sender` → `funnemail-classify` → `classify-inbound-content`
- LEGACY parallelo: `check-inbox/postProcessing.ts` chiama ancora `classify-email-response` (scrive `email_classifications`). Da consolidare in fase successiva.

## Findings non ancora riparati (audit completo in chat 2026-05-05)
- `check-inbox/postProcessing.ts` usa `fetch` diretto invece di `invokeAi` charter
- Filtri newsletter hardcoded duplicati tra trigger SQL e `email_address_rules`
- `categorize-content` orfana (ai-utility forward, no caller)
- `email_classifications` non logga in `ai_interaction_log`
