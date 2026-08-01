---
name: Prompt Copilot + KB Index Map
description: Chat AI nel Prompt Reader propone diff su blocchi prompt usando KB Index Map; intake nuovo materiale KB → proposte
type: feature
---
- `/v2/prompt-reader`: 3a colonna Co-pilot con tab Chat/Mappa KB/Aggiungi KB.
- Edge functions: `prompt-copilot-chat` (Editor diff su blocco), `kb-index-map` (mappa famiglie+intent), `kb-intake-analyze` (suggerimenti categoria/duplicati/conflitti).
- Tabelle: `prompt_change_proposals` e `kb_entry_proposals` (mai scrittura diretta su `operative_prompts` o `kb_entries`).
- DAL: `src/data/promptChangeProposals.ts`, `src/data/kbProposals.ts`.
- 6 famiglie canoniche KB (doctrine/procedures/personas/playbooks/glossary/data-schema). Decision tree intent→famiglie in `docs/governance/kb-index-map.md`.
- Complemento ADR 0004 in `docs/governance/cobra-blocks-and-roles.md` (4 ruoli COBRA + mapping blocchi).
- Charter: chat passa da `supabase.functions.invoke` con `scope='lab'` e `context.source='prompt-reader-copilot'`.
