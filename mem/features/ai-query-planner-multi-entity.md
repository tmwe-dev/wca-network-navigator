---
name: AI Query Planner Multi-Entity
description: Il fast-lane query planner ritorna 1..N piani per gestire prompt multi-entità (es. "quanti partner E contatti"). Output sempre {plans:[...]}, executor in parallelo via Promise.allSettled, ToolResult kind:"multi" con parts[]. Audit mostra N step paralleli.
type: feature
---

## Cosa cambia

`supabase/functions/ai-query-planner` ora produce SEMPRE `{ plans: [...] }` (1..N, cap 4). Singola entità → 1 piano (retro-compatibile, comportamento UI identico). Multi entità → N piani eseguiti in parallelo.

## Catena tocchi

- `ai-query-planner/index.ts` — system prompt istruisce multi-piano + JSON shape `{plans:[...]}`. Loop COUNT/LIST applicato per ogni piano.
- `src/v2/io/edge/aiQueryPlanner.ts` — `QueryPlanBatchSchema` (Zod union) accetta sia nuovo che vecchio, normalizza in `{plans:[]}`.
- `src/v2/ui/pages/command/tools/aiQueryTool.ts` — `Promise.allSettled` su tutti i piani. Se 1 piano → emit `kind:"table"` (zero regression). Se >1 → emit `kind:"multi"` con `parts[]`. Cache `_lastSuccessfulPlan` = primo piano riuscito.
- `src/v2/ui/pages/command/tools/types.ts` — nuovo `kind:"multi"` + `MultiResultPart`.
- `src/v2/ui/pages/command/lib/localResultFormatter.ts` — `tryLocalCommentMulti(parts)` concatena conteggi senza chiamare l'LLM.
- `src/v2/ui/pages/command/hooks/useResultCommentary.ts` — branch su `kind:"multi"` → multi-formatter.
- `src/v2/ui/pages/command/hooks/useFastLane.ts` — un trace step per ogni parte del multi (label "ai-query · <table>"), così l'audit mostra "N step".
- `src/v2/ui/pages/command/aiBridge.ts` — `serializeResultForAI` gestisce `multi` con sample 3 righe per parte.
- `src/v2/ui/pages/command/components/CommandCanvas.tsx` — nuovo render `live-multi`: una sezione per ogni `part` con titolo, count, durata, e mini TableCanvas.
- `src/v2/ui/pages/command/hooks/usePlanCompletion.ts` + `constants.ts` — `CanvasType` esteso con `live-multi`.

## Cosa NON è stato toccato e perché

- `ai-assistant/systemPrompt.ts` — già KB-driven, già gestisce entità multiple via tool separati (search_partners, search_contacts ecc.)
- `agent-execute/systemPrompt.ts` — già persona+KB-driven, niente knowledge DB hardcoded
- altri orchestratori (agentic-decide, unified-assistant, agent-loop) — passano da tool, non scrivono SQL

## Esempio

Prompt: "quanti address e contatti in totale abbiamo nel sistema"
→ planner: `plans:[{table:"partners",columns:["id"],limit:1}, {table:"imported_contacts",columns:["id"],limit:1}]`
→ executor: Promise.allSettled (2 query)
→ Direttore: "Nel sistema ci sono **25.103 partner** e **11.414 contatti**. Vuoi filtrarli per paese?"
→ Audit: "Fast lane · 2 step · driver: ai-query · 1.6s"
