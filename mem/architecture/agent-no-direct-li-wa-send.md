---
name: Agent No Direct LI/WA Send
description: agent-execute non invia mai LinkedIn/WhatsApp. Crea solo proposte in ai_pending_actions; l'invio reale è solo manuale dal cockpit con journalistReview hard.
type: feature
---

## Regola

`agent-execute/toolHandlers/emailTools.ts` → `handleSendWhatsApp` e `handleSendLinkedIn`:
- NON inseriscono più in `activities` con stato pending fingendo l'invio.
- NON chiamano la pipeline post-send.
- INSERISCONO in `ai_pending_actions` con `action_type = send_whatsapp | send_linkedin`, status `pending`, source `agent:<id>`.
- Ritornano `{ success: true, queued_for_approval: true, pending_action_id }` con messaggio chiaro: "richiede approvazione e invio manuale dal cockpit".

## Invio reale

Il send fisico LI/WA avviene SOLO dal cockpit utente attivo:
- WhatsApp → `useSendWhatsApp` → `useWhatsAppExtensionBridge.sendWhatsApp` → postMessage `from-webapp-wa`.
- LinkedIn → `useSendLinkedIn` → `useLinkedInExtensionBridge.sendDirectMessage` → postMessage `from-webapp-li`.

Entrambi i path passano OBBLIGATORIAMENTE da edge function `review-message` (gate hard `journalistReview`). `verdict === 'block'` blocca l'invio; `pass_with_edits` sostituisce il testo. Errore review = fail-closed.

## Componenti

- Edge: `supabase/functions/review-message/index.ts` (gate editoriale per WA/LI client-side).
- Helper: `src/lib/messaging/reviewMessage.ts` (wrapper invokeEdge fail-closed).

## Cosa NON è risolto qui (debito noto, da decidere)

- `pending-action-executor` → `send-linkedin`/`send-whatsapp` puntano ancora a `extension_dispatch_queue` non consumata. L'approvazione di un `ai_pending_action` di tipo send_li/send_wa non produce invio reale. Fix futuro: convertire in alert all'operatore o pipeline realtime → cockpit attivo.
- Daily cap LinkedIn (50/giorno) ancora basato su `extension_dispatch_queue` (zero). Da spostare su `channel_messages` o configurare lato settings.
- WhatsApp bridge ping ogni 3s (rumore).
