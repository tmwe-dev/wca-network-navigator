

# Plan: Prompt 93 — Verifica e Fix Flussi Backend Reali

## Summary

Verify and fix all end-to-end backend flows: connect placeholder buttons to real Edge Functions, ensure auto-classification after email sync, and eliminate empty/placeholder handlers.

---

## Step 1 — IMAP Flow: Auto-classify after check-inbox

Verify that `check-inbox` calls `classify-email-response` for each new email saved. If not, add the call inside the sync loop (using service_role since it's a backend-to-backend call).

## Step 2 — Connect manage-email-folders to UI

Add folder action buttons (archive, spam, move) to SmartInboxView with dropdown menu calling `manage-email-folders` Edge Function via `invokeEdge`.

## Step 3 — Connect suggest-email-groups to UI

Verify that "Analizza con AI" button in AISuggestionsTab actually invokes the Edge Function. Fix if handler is empty/placeholder.

## Step 4 — Connect calculate-lead-scores to CRM

Add "Ricalcola Score" button to CRM toolbar that invokes `calculate-lead-scores` and invalidates contact queries.

## Step 5 — Connect save-correction-memory

Verify that email classification corrections in SmartInboxView call `save-correction-memory` to persist learning.

## Step 6 — Smoke Test: Eliminate placeholder handlers

Search for `() => {}`, `"Coming soon"`, `"TODO"` handlers across main pages (Outreach, AI Arena, AI Control Center, Email Intelligence, CRM). Connect to real handlers or disable with tooltip.

## Step 7 — Verify A/B Testing E2E

Verify ABTestCreator inserts into `ab_tests` and ABTestResults reads from it.

## Step 8 — Verify

- 0 TypeScript errors
- All buttons have real handlers or are disabled
- Edge Functions invoked via `invokeEdge` (not `supabase.functions.invoke` directly)

---

## Files to inspect/modify

| Action | File |
|--------|------|
| Edit | `supabase/functions/check-inbox/index.ts` (add auto-classify) |
| Edit | SmartInboxView component (add folder actions + correction memory) |
| Edit | AISuggestionsTab component (verify suggest-email-groups call) |
| Edit | CRM page/toolbar (add lead score button) |
| Edit | ABTestCreator + ABTestResults (verify E2E) |
| Audit | All main page components for placeholder handlers |
