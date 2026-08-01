---
name: Prompt Lab Audit 2026-05-11
description: Snapshot audit Prompt Lab TMWE — 62/100. Mappa pagine, agenti improvement, stato DB e 3 loop rotti.
type: reference
---

# Prompt Lab Audit — 11 maggio 2026

Voto complessivo: **62/100**

## Pagine & tab
- `PromptLabPage.tsx`: 4 macro gruppi (Core AI, Communication, Strategy, Operations) × ~20 tab.
- Sister pages:
  - `/v2/prompt-lab/atlas` (Agent Atlas a 4 colonne)
  - `/v2/prompt-lab/catalog` (vista unificata operative_prompts)
  - `/v2/prompt-lab/tests` (test cases + runs)
  - `/v2/prompt-lab/proposals` (prompt_change_proposals)
  - `/v2/prompt-lab/suggestions` (refiner suggestions)
  - `/v2/prompt-lab/agent/:slug` (dettaglio agente)

## 7 agenti di improvement
| Agente | Trigger | Output |
|---|---|---|
| `prompt-copilot-chat` | modes diagnose/edit/global | `prompt_change_proposals` |
| `agent-prompt-refiner` | cron settimanale (NON schedulato) | `ai_pending_actions` |
| `Architect` | bottone "Analizza con Architect" | `ArchitectDiagnosticV2` |
| `prompt-test-runner` | manual/cron | `prompt_test_runs` |
| `refine-classification-rule` | email classifications | nuove regole |
| `prompt-registry-drift-check` | cron | drift report |
| `Harmonizer` | bottone "Armonizza System" | proposta unificata |

## Stato DB
- `operative_prompts`: **136 active rows / 54 distinct names** (duplicazioni)
- `kb_entries`: 249 in 28 categorie (120 "doctrine")
- `agent_personas`: 8, tutte con `custom_tone_prompt` < 50 char (vuote)
- `prompt_versions`: 270 snapshot
- `prompt_test_cases`: 17 (coverage 31%)
- `prompt_test_runs` ultimi 30g: **0**
- `ai_pending_actions(prompt_refinement)`: 0

## 3 loop rotti
1. **Refiner senza cron** → nessuna proposta automatica
2. **Test runner inattivo** → 0 run in 30 giorni
3. **Personas vuote** → identità agenti non iniettate

## Conseguenza
Solo edit manuali via copilot migliorano i prompt. Il sistema non si auto-migliora.