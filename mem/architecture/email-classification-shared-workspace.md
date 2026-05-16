---
name: Email Classification Shared Across Workspace
description: email_address_rules, email_sender_groups, operative_prompts condivisi tra tutti gli operatori
type: feature
---
Classificazione mittenti, gruppi, prompt operativi e auto-azioni sono **condivisi a livello workspace**: se un operatore categorizza un indirizzo, tutti gli altri lo vedono già categorizzato. Il contenuto delle email (`channel_messages`) resta strettamente per `user_id`/`operator_id`.

- RLS: `email_address_rules`, `operative_prompts` hanno policy `*_shared_*` USING(true)/WITH CHECK(true) per `authenticated`. `email_sender_groups` già condivisi via `esg_*_shared`.
- DAL: `findEmailAddressRules`, `findOperativePrompts*`, `bulkUpdateAutoAction`, `bulkSetBlocked` NON filtrano per `user_id`.
- `upsertEmailAddressRule`: cerca regola esistente per `email_address` (qualsiasi user), update se trovata, insert col current user altrimenti.
- Edge: `_shared/operativePromptsLoader.ts` carica tutti i prompt attivi senza filtro user.
