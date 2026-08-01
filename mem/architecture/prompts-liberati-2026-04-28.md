---
name: Prompts Liberati 2026-04-28
description: Refactor sistemico AI prompts — rimosse regole hardcoded da generate-outreach, classify-email-response, generate-aliases; tutto in Prompt Lab DB. Eliminato src/v2/agent/kb/dbSchema.ts, sostituito da liveSchemaClient + allowedTables.ts (solo whitelist).
type: feature
---
Refactor 2026-04-28 in 4 fasi:

1. Eliminato `src/v2/agent/kb/dbSchema.ts`. Sostituito da `src/v2/ui/pages/command/lib/allowedTables.ts` (solo whitelist + defaultSort) + `liveSchemaClient.ts` (introspezione live via RPC `ai_introspect_schema`). `safeQueryExecutor` ora valida colonne contro lo schema reale, niente più array statico disallineato.

2. `generate-outreach/promptBuilder.ts`: system prompt sceso da ~80 LOC a ~10 LOC. Rimossi: filosofia WCA, metodo 1-2-3, language rules estese, regole anti-WhatsApp, anti-ripetizione, lunghezze fisse. Tutto vive ora nel Prompt Lab come 4 nuovi `operative_prompts`: "WCA Filosofia & Posizionamento", "Language & Tono Cross-Country", "Anti-Ripetizione Multi-Touch", "Zero Allucinazioni & Onestà Dati" (OBBLIGATORIA).

3. `classify-email-response/classificationPrompts.ts`: rimosse DOMAIN DETECTION RULES hardcoded e duplicazione lista 28 categorie. Le categorie ora vengono iniettate dinamicamente dai `VALID_*` (contratto schema), le regole semantiche dal Prompt Lab ("Email Domain Detection Rules").

4. `generate-aliases/index.ts`: rimosso `SYSTEM_PROMPT` hardcoded di 14 righe con regole stilistiche alias. Sostituito da `BASE_IDENTITY` minimale + iniezione runtime via `loadOperativePrompts` con scope general + tag aliases/copywriting. Le regole vivono nel prompt "Alias Generation Rules (Companies & Contacts)". La funzione ora accetta opzionalmente `userId` nel body o lo deriva dall'auth header.

Doctrine attiva: `mem://architecture/ai-prompt-freedom-doctrine` — i prompt TS contengono SOLO identità+obiettivo+contesto. Tutte le regole business vivono nel Prompt Lab DB. Guardrail tecnici in `hardGuards.ts`.

File rifattorizzati:
- src/v2/ui/pages/command/lib/safeQueryExecutor.ts
- src/v2/ui/pages/command/lib/allowedTables.ts (nuovo)
- supabase/functions/generate-outreach/promptBuilder.ts
- supabase/functions/classify-email-response/classificationPrompts.ts
- supabase/functions/generate-aliases/index.ts

Migration: 4 nuovi `operative_prompts` seedati per ogni utente.