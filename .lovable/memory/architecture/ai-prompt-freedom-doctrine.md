---
name: AI Prompt Freedom Doctrine
description: I prompt TS contengono SOLO identità+obiettivo+contesto. Tutte le regole business vivono nel Prompt Lab DB (operative_prompts). Guardrail tecnici in hardGuards.ts. Niente regole duplicate, niente ricette step-by-step, niente liste di frasi vietate.
type: preference
---
Filosofia: AI è uno spazio aperto a 360°. Ogni istruzione lo restringe. Diamo guardrail (cosa NON può fare, in codice), non binari (cosa DEVE dire, nei prompt).

Tre layer:
1. Identità + obiettivo + contesto → nel system prompt TS (minimale, ~30-50 LOC max)
2. Regole business / doctrine commerciali → nel Prompt Lab DB (operative_prompts), iniettate via _shared/operativePromptsLoader.ts
3. Guardrail tecnici hard (no DELETE, bulk cap, FORBIDDEN_TABLES, approval gate) → src/v2/agent/policy/hardGuards.ts + RLS + trigger DB

VIETATO nei system prompt TS:
- Liste di frasi proibite (es. FORBIDDEN_KEYWORDS in agent-loop, eliminate)
- Lunghezze fisse di output (es. "80-150 parole", "max 3 azioni")
- Formato output rigido se non strettamente richiesto dall'UI
- Doctrine duplicate (es. "WhatsApp solo se lead_status in [...]" → vive solo nel DB)
- Step-by-step procedurali ("1. LEGGI 2. ANALIZZA 3. RIANCORA...")

File rifattorizzati 2026-04-28:
- src/v2/agent/prompts/core/{luca,super-assistant,cockpit-assistant,contacts-assistant}.ts
- supabase/functions/agent-loop/index.ts (rimossa FORBIDDEN_KEYWORDS, prompt snellito)
- supabase/functions/improve-email/index.ts (60 LOC system prompt → 20 LOC)
- supabase/functions/generate-email/promptBuilder.ts (220 LOC system prompt → 15 LOC)

Capacità AI da promuovere:
- Se una ricerca torna vuota, varia (accenti, sinonimi, scope ridotto, solo cognome)
- Se l'utente chiede qualcosa di incoerente col contesto, fallo notare prima di eseguire
- Scegliere tu il formato output in base a cosa serve all'utente
