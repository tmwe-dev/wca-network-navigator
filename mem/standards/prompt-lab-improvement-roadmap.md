---
name: Prompt Lab Improvement Roadmap
description: Roadmap P0-P3 per portare Prompt Lab da 62 a 85+. Cron refiner, dedup operative_prompts, popolamento personas, coverage test, dashboard health.
type: standard
---

## P0 — Sblocca i loop automatici
1. Schedulare `agent-prompt-refiner` (cron settimanale lun 04:00 UTC).
2. Schedulare `prompt-test-runner` (cron giornaliero 03:00 UTC su ultimi 30 prompt usati).
3. Banner "Suggestions pendenti" su `PromptLabPage` con count `ai_pending_actions(type=prompt_refinement, status=pending)`.
4. Dedup `operative_prompts`: 136 → 54 (mantenere versione attiva più recente per nome, soft-delete duplicati).

## P1 — Personas + test coverage
1. Popolare le 8 `agent_personas` con `custom_tone_prompt` ≥ 300 char (seed da `mem://reference/personas-seed-from-radiochat`).
2. CHECK constraint `length(custom_tone_prompt) >= 300` quando `is_active=true`.
3. Aggiungere 20+ test cases per coprire i prompt critici (target coverage 70%).

## P2 — KB refactor
1. Spaccare la categoria "doctrine" (120/249) in sottofamiglie (`doctrine-tone`, `doctrine-business`, `doctrine-tech`).
2. Audit semantico settimanale via `kb-doctrine-audit` (già attivo).

## P3 — Health dashboard
Nuova tab `Health` in `PromptLabPage` con KPI:
- # operative_prompts attivi / distinct
- # personas popolate / vuote
- coverage test = test_cases_run / total_active_prompts
- ultime 7 esecuzioni refiner
- drift detector report

## Out of scope
- Modifiche a prompt esistenti senza approvazione
- Refactor `PromptLabPage` (solo aggiunte di tab)