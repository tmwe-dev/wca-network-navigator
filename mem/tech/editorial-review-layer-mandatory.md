---
name: Editorial Review Layer Mandatory
description: journalistReview obbligatorio e INTOCCABILE su ogni email/WA/LI prodotti o inviati. Niente kill-switch utente.
type: constraint
---
# 🔒 Editorial Layer — INTOCCABILE

`_shared/journalistReviewLayer.ts` è l'unico revisore editoriale del sistema.
È OBBLIGATORIO su ogni produzione o invio di email, WhatsApp e LinkedIn.

## No kill-switch

`loadOptimusSettings()` ritorna SEMPRE `enabled: true`. La chiave
`app_settings.journalist_optimus_enabled` è IGNORATA. L'utente può configurare
solo `mode` (review_and_correct | review_only | silent_audit) e `strictness`
(1-10). Mai più disattivare il giornalista.

## 9 punti coperti (verificati 2026-05-02)

### Produzione
1. `supabase/functions/generate-email/index.ts` — bozza generata
2. `supabase/functions/improve-email/index.ts` — bozza migliorata

### Invio diretto (gate finale, fail-open su errore LLM)
3. `supabase/functions/send-email/index.ts`
4. `supabase/functions/send-whatsapp/index.ts`
5. `supabase/functions/send-linkedin/index.ts`

### Coda batch SMTP
6. `supabase/functions/process-email-queue/index.ts`

### Agent tools (server-side)
7. `agent-execute/toolHandlers/emailTools.ts · handleSendEmail`
8. `agent-execute/toolHandlers/emailTools.ts · handleSendWhatsApp`
9. `agent-execute/toolHandlers/emailTools.ts · handleSendLinkedIn` ← aggiunto 2026-05-02

## Skip esplicito (anti doppia review)

Solo se l'upstream ha già fatto la review può passare `journalist_reviewed: true`
nel body verso `send-email/-whatsapp/-linkedin`. Lo fa SOLO `improve-email`. Il
frontend non lo passa mai.

## Contesto al giornalista

Ogni orchestratore che invoca `send-*` DEVE passare `partner_id` (e `contact_id`
quando disponibile) per dare contesto commerciale al giornalista. Patch
2026-05-02 ha sistemato: `pending-action-executor`, `cadence-engine`,
`_shared/platformTools/outreachHandler`, `_shared/platformToolHandlers/outreachTools`,
`_shared/toolHandlersWrite · executeSendEmail`.

## Test di regressione

`src/test/journalist-pipeline-coverage.test.ts` (11 test) verifica:
- ogni produttore/invio chiama `journalistReview()`;
- `loadOptimusSettings` ritorna `enabled:true` e non legge più la chiave;
- nessun chiamante usa `optimus.enabled &&` come gate;
- ogni body diretto a `send-email` contiene `partner_id`.

Violare uno qualsiasi di questi punti = bug critico.