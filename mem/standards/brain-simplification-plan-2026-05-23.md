---
name: Brain Simplification Plan 2026-05-23
description: Piano multi-fase per collassare cervello AI in un'unica pagina configuratore (avatar canale + icona tono). Da eseguire con Codex, una fase per volta, senza rompere comportamento esistente.
type: standard
---

## Obiettivo
Una sola pagina `/v2/brain`:
- **Avatar** = canale (Email, WhatsApp, LinkedIn, Voce, Command)
- **Icona Tono** = registro (Formale, Cordiale, Diretto, Caloroso, Tecnico)
- Click avatar → drawer: persona, prompt operativi attivi, KB, tool whitelist, modello. Editabile in-line.
- Sostituisce 49 rotte config + 4 tabelle agente.

## Numeri audit 2026-05-23
- 150 edge functions (~48 AI)
- 45 agents / 45 capabilities / 8 personas (37 vuote) / 45 routing_config / 5 routing_rules
- 136 operative_prompts attivi, 52 distinct → **84 duplicati**
- 8 prompt_templates + 3 email_prompts (legacy)
- 335 kb_entries, 270 prompt_versions
- 17 test cases, 34 runs/30d, 5 ai_interaction_log/7d (telemetria spenta)

## MANTENERE
1. `operative_prompts` (SSOT regole) — dopo dedup
2. `agents` + `agent_capabilities`
3. `kb_entries` + `prompt_versions`
4. Edge core: `agent-execute`, `agent-loop`, `generate-email`, `generate-outreach`, `improve-email`, `classify-email-response`, `ai-assistant`
5. `_shared/operativePromptsLoader.ts`, `hardGuards.ts`, `journalistReview`
6. AI Invocation Charter (`invokeAi` + `ai_scope_registry`)
7. Prompt Lab Catalog/Atlas (riusati read-only nel nuovo /brain)

## DEPRECARE
| Item | Azione | Fase |
|---|---|---|
| `prompt_templates` (8) | migra → operative_prompts, drop | F3 |
| `email_prompts` (3) | migra → operative_prompts, drop | F3 |
| `agent_routing_rules` (5) | merge in capabilities, drop | F4 |
| `ai_routing_config` (45) | esponi via view, no drop | F4 |
| 84 duplicati operative_prompts | soft-delete (keep latest per name) | F2 |
| 8 hub config sparse | redirect → `/v2/brain` | F5 |
| Loop morti: prompt-copilot-chat, Architect, Harmonizer, refine-classification-rule, agent-prompt-refiner | freeze + flag | F6 |
| 2 context "free-text" bug | normalizza | F2 |

## Fasi (una per turno, codex protocol)

### F0 — Baseline & Safety
Snapshot DB → `_brain_simplification_backup_2026_05_23`. Solo migration CREATE TABLE AS SELECT. Zero runtime impact.

### F1 — View `v_agent_full` (additiva)
JOIN agents+capabilities+personas+routing_config + RPC `get_agent_full(id)`. Read-only.

### F2 — Dedup operative_prompts
Soft-delete duplicati (MAX(updated_at) per name+context+scope). Normalizza 2 context bug. Snapshot in prompt_versions. 136→52.

### F3 — Migra legacy prompts
INSERT prompt_templates + email_prompts in operative_prompts. Loader li include via scope. DROP a +7gg.

### F4 — Collasso routing
ALTER agent_capabilities ADD routing_rules jsonb. Migra 5 rules, drop tabella. ai_routing_config via view.

### F5 — Pagina `/v2/brain` (UI nuova)
Griglia avatar canale (5) × icone tono (5). Drawer CanvasShell con: Persona | Prompts | KB | Tool | Modello | Test rapido. Riusa hook esistenti. Zero edge nuove. Redirect 8 hub legacy → `/v2/brain`.

### F6 — Sunset loop morti
Flag `is_deprecated`. Banner UI. Edge file restano, rimuovi da cron, log warn.

### F7 — Cleanup (dopo 30gg test)
DROP tabelle legacy + delete edge deprecate. Target: 48→~25 edge AI, 4→2 tabelle agente, 49→1 rotta.

## Regole esecuzione
- **Una fase per turno.** Mai accorpare.
- Ogni fase: SC:CLASSIFY → DEFENSE → ROLLBACK → VERB → ANTI → CHANGELOG
- INTOCCABILI: `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview`, `hardGuards`, RLS, `from-webapp-li`
- Mai DELETE fisica (soft-delete trigger attivo)
- Smoke post-fase: `/v2/command` + `generate-email` + `agent-execute`

## Trigger
Utente dice "vai con F0", "F1", ecc. Mai partire da soli.
