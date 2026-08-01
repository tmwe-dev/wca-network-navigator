---
name: Sprint Codex 2026-05-11 Iter 2
description: Esecuzione piano "Funnemail/Holding/Prompt Lab" — Sprint B+C parziali. Cron refiner + 12 funnemail_policy + RPC banner Health
type: reference
---

## Audit reale (correzione vs plan iniziale)
- Pipeline inbound NON è morta: `funnemail_decisions` 39/30gg coerente con volume vero (~10-50 inbound/giorno; i 6679 erano backfill).
- `email_classifications` (legacy classify-email-response) deprecato → ora classify-inbound-message orchestratore unico.
- Vero blocco: `funnemail_policy=0`, `agent-prompt-refiner` non schedulato, `prompt_lab_cron_status` RPC mancante.

## Modifiche atomiche applicate
1. Cron `agent-prompt-refiner-weekly` (lun 04:00 UTC, jobid 58) via `scheduler_cron_secret`.
2. RPC `prompt_lab_cron_status()` SECURITY DEFINER → banner `PromptLabHealthBanner` ora valuta correttamente `cronTestRunner` e `cronRefiner`.
3. Seed 12 policy in `funnemail_policy` per 3 utenti operativi (luca/luigi/alex), 4 gruppi a basso rischio (newsletter/transactional/system/internal) — solo azioni `tag_only|snooze`. ZERO `draft_reply` / `autoresponder` → editorial review intoccato.

## NON applicato (richiede approvazione user)
- Dedup operative_prompts: i 136 attivi sono 1 per utente × 6 utenti × ~22 prompt = struttura corretta, NON duplicati. Audit iniziale errato.
- Seed personas: già 8 righe, ogni persona è business-specific → seed massivo rischia override.
- SLA badge Holding Pattern, dashboard Funnemail → richiedono UI dedicata.

## KPI da verificare
- Domani 04:00 UTC: prima esecuzione refiner → `ai_pending_actions(type='prompt_refinement')` dovrebbe salire.
- Stanotte 03:45 UTC: prima esecuzione test runner.
- Prossime inbound da gruppi `newsletter/transactional` → `funnemail_actions_log` dovrebbe ricevere insert.

## Rollback
- `SELECT cron.unschedule('agent-prompt-refiner-weekly')` per disattivare cron.
- `UPDATE funnemail_policy SET enabled=false WHERE created_at > '2026-05-11'` per spegnere seeds.
- `DROP FUNCTION public.prompt_lab_cron_status` per togliere RPC banner.
