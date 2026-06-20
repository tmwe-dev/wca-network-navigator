---
name: Command AI Query Resilience
description: Architettura AI-native del Command — il planner AI è l'unica autorità, niente parser hardcoded; routing scope e provider
type: feature
---
# Command — Ricerca AI-native (refactor 2026-06)

## Principio (richiesto esplicitamente dall'utente)
NIENTE binari hardcoded / parser deterministici nell'interpretazione delle query.
L'AI riceve schema live + scopo tabelle + storia COMPLETA della conversazione e
decide liberamente: tabella, filtri, count/list, follow-up ellittici, smalltalk.
I guardrail (whitelist tabelle, solo-SELECT, validazione colonne/enum, RLS) restano
in codice nel `safeQueryExecutor` — la libertà è nel *cosa* chiedere, non nei limiti.

## Componenti
- `supabase/functions/ai-query-planner/index.ts`: UNICA autorità. Riceve prompt + history + schema live. Output: `plans[]` con table reale, oppure `table:"SMALLTALK"` (rationale = risposta conversazionale da leggere all'utente) oppure `table:"INVALID"` (azione/non-query). Usa la cronologia per i follow-up ellittici ("e in Italia?" eredita partners + country_code).
- `src/v2/ui/pages/command/tools/aiQueryTool.ts`: chiama SEMPRE il planner (niente parser locale). 1 retry su 429; gestisce SMALLTALK/INVALID; esegue i piani via `safeQueryExecutor`.
- `src/v2/ui/pages/command/lib/localResultFormatter.ts`: formatta il commento (dato+proposta+voce) dai dati REALI del risultato per evitare un secondo hop AI. NON interpreta il prompt — solo display. `COUNTRY_LABELS` esportato (code→label) e riusato da `useFastLane`.
- `src/v2/ui/pages/command/hooks/useFastLane.ts`: deriva il paese dai FILTRI REALI del piano (country_code), non da regex sul prompt.
- RIMOSSI: `lib/localIntentParser.ts` (+test), `buildHintFromDurableContext`, `COUNTRY_LOOKUP` duplicato, hint sintetici "CONTESTO TURNO PRECEDENTE: tabella=...".

## Routing provider (CAUSA RADICE storica dei fallimenti AI — 2026-06)
- Lo scope passato a `aiChat` DEVE combaciare con una riga di `ai_routing_config`. Il planner passava `scope:"query_planning"` ma la riga è `ai_query_planner` → bypass del routing.
- `OPENAI_API_KEY` ha la QUOTA ESAURITA ("exceeded your current quota"): qualsiasi scope su provider `openai` (gpt-4o) restituisce 429. Era la vera ragione per cui "l'AI non rispondeva più a nulla".
- FIX: `ai_query_planner` instradato su `provider:google, model:gemini-2.5-flash` (chiave separata, quota disponibile). Gli altri scope ancora su openai falliranno finché la quota OpenAI non viene ripristinata o reinstradata.

## Comportamento atteso (verificato dal vivo 2026-06)
- "ciao, tutto bene?" → SMALLTALK con risposta conversazionale parlata.
- "quanti partner a Malta?" → partners + country_code=MT, conteggio.
- "e in Italia?" (follow-up) → eredita partners + country_code=IT dalla storia, conteggio.
- Su 429 reale: messaggio chiaro "servizio AI occupato, riprova", NON un fallback che inventa.
