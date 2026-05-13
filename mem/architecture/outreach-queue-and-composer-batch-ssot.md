---
name: Outreach Queue + Composer Batch SSOT
description: useOutreachQueue e ComposerCanvas batch non inviano più direttamente; trasferiscono in ai_pending_actions per approvazione umana
type: feature
---

# Fix Codex 2026-05-13 — chiusura 3 violazioni SSOT v3.9.56

## Cosa cambia

1. **`src/hooks/useOutreachQueue.ts`**: rimosse chiamate dirette a
   `wa.sendWhatsApp`, `li.sendDirectMessage` e `invokeEdge("send-email")`.
   Ogni item della coda viene ora **trasferito** in `ai_pending_actions`
   (status `pending`, source `outreach_queue`, action_type derivato dal
   canale) e marcato `transferred` nella tabella `outreach_queue`.
   L'invio reale segue la pipeline `useApproveAndDispatch` (editorial
   review hard).

2. **`src/v2/ui/pages/command/canvas/ComposerCanvas.tsx`**:
   `handleSendAllBatch` non chiama più `invokeEdge("send-email")` per
   ogni bozza. Inserisce N record `ai_pending_actions`
   (`source: "composer:send-batch"`). `invokeEdge` resta per la
   rigenerazione AI (`generate-email`), che è AI gateway, non send.

3. **`src/components/partners/PartnerDetailCompact.tsx`**:
   `handleSendWhatsApp` non chiama più `sendWhatsApp(phone, "")` come
   sonda. Naviga su `/v2/inbox` con stato pre-aperto (stesso pattern di
   `useDirectContactActions`). `useWhatsAppExtensionBridge` resta solo
   per `isAvailable` (badge UI).

## Perché

Memoria `Approval Dispatch Pipeline v3.9.56`: ogni invio email/WA/LI
deve passare da `ai_pending_actions` → approvazione umana →
`useApproveAndDispatch`. Le 3 sedi sopra erano i soli bypass attivi e
aggiravano `journalistReview` (editorial review hard).

## Test

`src/test/messaging-ssot-governance.test.ts` continua a passare (3/3).
