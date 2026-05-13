---
name: Email Send SSOT Enforcement
description: Tutti gli invii email frontend passano da useEnqueueAction → ai_pending_actions → useApproveAndDispatch → edge send-email. Nessun invokeEdge('send-email') diretto in UI.
type: constraint
---
**Pipeline unica (v3.9.56)**:
1. UI/cockpit/command → `useEnqueueAction({action_type:"send_email"})` o insert diretto in `ai_pending_actions` se fuori da React (tools command).
2. PendingActionsPanel → `useApproveAndDispatch.dispatch(id)` (su click "Approva").
3. `dispatchEmail()` → `invokeEdge("send-email", ...)` UNICO call site frontend.
4. Edge `send-email` applica `journalistReview` HARD fail-closed lato server (403 JOURNALIST_BLOCK se verdict=block).

**Eccezioni autorizzate**:
- `src/components/settings/GeneralSettings.tsx::handleTestEmail` — test diagnostico SMTP, non commerciale.
- `supabase/functions/funnemail-send-autoresponder` — autoresponder template-only (vedi memoria dedicata).
- `supabase/functions/cadence-engine|pending-action-executor|agent-execute|super-mario` — orchestratori server-side, devono passare `journalist_reviewed:true` solo se hanno già fatto la review nel proprio flusso.

**Vietato in UI**: `invokeEdge("send-email")`, `supabase.functions.invoke("send-email")` o `fetch(.../send-email)` diretti dal frontend, eccetto `useApproveAndDispatch.dispatchEmail`.

**Refactor 2026-05-13** (Codex Cobra): rimossi bypass in `EmailCanvas.tsx`, `SendEmailDialog.tsx`, `useSortingJobs.useSendJob`, `v2/.../command/tools/sendEmailDirect.ts`. Ora tutti enqueue.
