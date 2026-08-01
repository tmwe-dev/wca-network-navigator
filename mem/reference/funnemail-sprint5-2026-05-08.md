---
name: Funnemail Sprint 5 — Eval set + Brain view + Operations
description: Sprint 5 audit Funnemail. Test regressione decisioni + vista cognitiva + dashboard operativa.
type: reference
---

# Sprint 5 — 2026-05-08

## Migrazioni
- `funnemail_eval_cases` (RLS: SELECT auth, modify admin) — payload inbound + decisione attesa + tags.
- `funnemail_eval_runs` (RLS: SELECT auth, modify admin) — esiti, diff, latency, cost.
- View `funnemail_brain_v` (security_invoker) — join `channel_messages` + `email_processing_jobs` + `funnemail_decisions` (LATERAL latest) + `funnemail_message_status` + counters da `funnemail_actions_log`. Cast `cm.id::text` per allinearsi alle colonne text di funnemail.

## Edge function
- `run-funnemail-eval` (auth: Bearer JWT richiesto, scrive con service role solo su tabelle eval). Input: `{case_id}` o `{tags[]}` o `{all:true}`. Esegue dry-run AI (model gemini-2.5-flash, NO side-effect su channel_messages/azioni), confronta con expected, scrive run.

## DAL + UI
- `src/data/funnemailEval.ts`, `src/data/funnemailBrain.ts`
- Tab "Eval Set" in `/v2/email-intelligence` (crea caso, run all, run singolo, esiti live)
- Pagina `/v2/email-intelligence/operations` — stat per stage + brain table live (15s refetch)

## Note
- Cron notturno NON impostato (richiede chiamata utente-specifica, fuori scope automatico). Trigger manuale da UI o CI.
- Hard guards intoccati: dry-run NON applica azioni, NON tocca journalistReview.
- Reversibile: tabelle nuove additive, view deletabile senza impatto.

## Stato pipeline (5 sprint)
1. Auth hardening + Job ledger
2. Decomposizione orchestratore + status materialization
3. Policy engine + action types tassonomia
4. Scout cache utente + routing rules composite
5. Eval set + brain view + operations dashboard