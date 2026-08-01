---
name: WCA v2.1 Risk Gate
description: Tassonomia rischio 7 livelli + two-phase commit + hard gate su ai_pending_actions
type: feature
---
Adottati 3 elementi di WCA v2.1 (resto scartato per non duplicare journalistReview/promptSanitizer/agent_personas):

1. **Enum `ai_action_risk`**: READ < PREPARE < WRITE < SEND < EXTERNAL_AUTOMATION < BULK < DESTRUCTIVE.
2. **Two-phase commit** su `ai_pending_actions`: nuovi campi `risk_level`, `executing_since`, `execution_attempts`, `last_error`, `hard_gate_check`. Status esteso con `executing` e `failed`. RPC `claim_pending_action(_action_id)` atomico. `reap_stuck_executing_actions()` chiude executing > 5min.
3. **Hard gate server-side** `ai_action_hard_gate(_risk, _partner_id, _contact_id)`: blocca SEND/BULK/EXTERNAL_AUTOMATION/DESTRUCTIVE se partner.lead_status ∈ {blacklisted,archived} o contact.blacklist_status ≠ none.

Helper edge: `supabase/functions/_shared/aiActionRiskGate.ts` con `claimAction`, `hardGate`, `finalizeAction`, `runGuardedAction(claim→gate→exec→finalize)`. Gate denial → 403, claim fallita → 409.

Da integrare progressivamente nelle edge che eseguono azioni AI queued (send-email, generate-outreach, agent-execute) — non rompe nulla finché non viene chiamato.
