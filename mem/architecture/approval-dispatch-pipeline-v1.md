---
name: Approval Dispatch Pipeline v1
description: Tutti gli invii (email/WA/LI) anche singoli del cockpit passano da ai_pending_actions; useApproveAndDispatch è l'unico dispatcher reale on-approve
type: feature
---

# Pipeline Approvazione → Invio Reale (v3.9.56+)

## Regola madre
**Ogni invio email / WhatsApp / LinkedIn — anche i singoli dal cockpit — passa
da `ai_pending_actions`.** Niente dispatch diretto ai bridge o a `send-email`
dagli hook UI. L'invio reale parte solo dopo approvazione esplicita.

## Flusso

```
Cockpit / Bulk / AI proposal
  → useEnqueueAction.enqueue()  →  ai_pending_actions (status=pending)
  → PendingActionsPanel "Approva"
  → useApproveAndDispatch.dispatch(id)
       ├── reviewMessage HARD fail-closed (WA/LI)
       └── canale:
             • send_email/send_proposal → invokeEdge("send-email")
             • send_whatsapp            → waBridge.sendWhatsApp (from-webapp-wa)
             • send_linkedin            → liBridge.sendDirectMessage (from-webapp-li)
             • linkedin_connect         → liBridge.sendConnectionRequest
  → UPDATE ai_pending_actions status='executed'/'failed'
  → INSERT supervisor_audit_log (decision_origin='user_approved')
```

## File chiave
- `src/hooks/useEnqueueAction.ts` — SSOT enqueue (insert ai_pending_actions).
- `src/hooks/useApproveAndDispatch.ts` — SSOT dispatch reale on-approve.
- `src/components/ai-control/PendingActionsPanel.tsx` — pulsante "Approva"
  ruta i tipi `send_*` su `useApproveAndDispatch`, gli altri restano su
  `pending-action-executor` server-side.
- `supabase/functions/pending-action-executor/index.ts` — cases
  `send_whatsapp`/`send_linkedin` rimossi (browser-only). Resta `send_email`
  come fallback per cron/scheduler.

## Hook cockpit migrati (no più dispatch diretto)
- `src/hooks/useSendEmail.ts`     → enqueue `send_email`
- `src/hooks/useSendWhatsApp.ts`  → enqueue `send_whatsapp`
- `src/hooks/useSendLinkedIn.ts`  → enqueue `send_linkedin` / `linkedin_connect`

## Editorial review
Centralizzata in `useApproveAndDispatch` PRIMA del dispatch dei canali
WA/LI. **Hard fail-closed**: se la review fallisce o blocca, nessun invio
parte. Mai duplicata negli hook cockpit.

## Cosa NON tocchiamo
- `useLinkedInExtensionBridge`, `useWhatsAppExtensionBridge` (bridge browser).
- Estensioni Chrome / protocollo `from-webapp-li|wa`.
- Edge `send-linkedin` / `send-whatsapp` (dormienti, coda morta v3.9.56).
- Edge `send-email` (invariato, riusato in approvazione).
