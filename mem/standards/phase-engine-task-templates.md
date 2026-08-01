---
name: Phase Engine Task Templates
description: Decomposizione task in 5 fasi cognitive (setup→analysis→debate→synthesis→deliverable) con 9 template tipo. Estratto da RadioChat src/lib/taskTemplates.ts per Command Page TMWE.
type: standard
---

## 5 fasi canoniche
| Fase | Icon | Cosa fa |
|---|---|---|
| `setup` | 🎯 | Definisce obiettivo, vincoli, criteri di successo |
| `analysis` | 🔎 | Raccoglie dati, identifica pattern e fatti rilevanti |
| `debate` | 💬 | Confronto multi-prospettiva, valutazione trade-off |
| `synthesis` | 🔄 | Convergenza verso conclusioni e raccomandazioni |
| `deliverable` | 📦 | Output finale strutturato (markdown/code/text) |

Non tutti i task usano tutte le fasi (vedi colonna `phases` per template).

## 9 task templates
| Template | Phases | Output | Mode |
|---|---|---|---|
| `report` | tutte | markdown | consultation |
| `analysis` | tutte | markdown | consultation |
| `plan` | tutte | markdown | consultation |
| `lesson` | setup/analysis/debate/deliverable | markdown | consultation |
| `creative` | setup/debate/synthesis/deliverable | markdown | consultation |
| `code` | setup/analysis/debate/deliverable | text | consultation |
| `brainstorm` | setup/debate/synthesis/deliverable | markdown | consultation |
| `review` | setup/analysis/debate/deliverable | markdown | consultation |
| `custom` | configurable | markdown | consultation |

Ogni template ha `phaseInstructions` per guidare gli agenti in ogni fase.

## Adattamento TMWE
Generalizzare in tabella `task_templates(id, type, phases jsonb, phase_instructions jsonb, output_format, suggested_mode)` editabile da Prompt Lab per:
- **Command Page** — orchestrator Director Luca seleziona template in base all'intent
- **Outreach campaigns** — già usano fasi parziali, allineare al pattern
- **Sherlock investigator** — già 3 livelli, mappare a setup/analysis/synthesis

## Vincoli
- Editorial review obbligatorio sulla fase `deliverable` per email/WA/LI
- Hard guards attivi su tool execution
- Phase transitions tracciate in `ai_interaction_log` per replay

## Riferimento
`/tmp/radiochat/src/lib/taskTemplates.ts` (171 LOC).