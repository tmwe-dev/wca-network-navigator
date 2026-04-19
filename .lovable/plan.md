

## Filosofia consolidata (4 livelli)

```text
LIVELLO 0 — POLICY HARD (codice, non discutibile)
  permessi, approval gate, side-effect lock, schema validation,
  whitelist tool, no DELETE, bulk cap, no auth/secrets
        ▼
LIVELLO 1 — PROMPT CORE (~30 righe)
  identità + obiettivo + guardrail soft + indice KB
        ▼
LIVELLO 2 — KB PROCEDURES (kb_entries, categoria procedures/doctrine)
  procedure dettagliate, schema, esempi
  → assembler INIETTA estratti mirati per workflow critici
  → list_kb / read_kb come fallback per esplorazione
        ▼
LIVELLO 3 — VARIABILI RUNTIME
  {{user_alias}}, {{recipient_count}}, {{kb_index}}, ...
```

## Cosa creo

**Livello 0 — Policy hard (codice)**
- `src/v2/agent/policy/hardGuards.ts` — funzioni pure: `assertNoDelete`, `assertBulkCap(n, max=5)`, `assertNotAuthTable`, `requiresApproval(toolId)`, `assertSchemaValid`. Usate dai dispatcher tool prima di qualunque side-effect.
- `supabase/functions/_shared/policy/hardGuards.ts` — gemello edge per validazione server-side.

**Livello 1 — Prompt core leggeri**
- `src/v2/agent/prompts/core/luca.md` (Director)
- `src/v2/agent/prompts/core/super-assistant.md`
- `src/v2/agent/prompts/core/contacts-assistant.md`
- `src/v2/agent/prompts/core/cockpit-assistant.md`
- `src/v2/agent/prompts/core/email-improver.md`
- `src/v2/agent/prompts/core/daily-briefing.md`
- `src/v2/agent/prompts/core/email-classifier.md`
- `src/v2/agent/prompts/core/query-planner.md`

Ogni file < 40 righe: identità, obiettivo, guardrail soft, indice KB, formato output.

**Livello 2 — Migration KB**
Insert in `kb_entries` (categoria `procedures` e `doctrine`):
- `procedures/outreach-flow` — Plan → Approve → Execute multicanale
- `procedures/email-improvement-techniques` — tecniche oggi inline in `buildImproveEmailSystemPrompt`
- `procedures/lead-qualification` — workflow 6 stage
- `procedures/bounce-handling`
- `procedures/multi-step-actions` — pattern check_job_status
- `procedures/ai-query-engine` — come usare planQuery / safeExecutor
- `doctrine/anti-hallucination`
- `doctrine/tone-and-format` — markdown, IT, formato output
- `doctrine/safety-guardrails` — versione "soft" per AI, in eco al Livello 0

**Assembler**
- `src/v2/agent/prompts/assembler.ts` — `assemblePrompt({ agentId, variables, kbCategories, injectExcerpts? })`:
  - carica core
  - risolve `{{variabili}}`
  - se `injectExcerpts` → carica e inietta i primi N caratteri delle entries KB chiave (per workflow critici)
  - aggiunge sempre indice KB (titoli + categoria, formato compatto)
  - ritorna stringa
- `supabase/functions/_shared/prompts/assembler.ts` — versione edge (legge KB con service role).

**Registro metadati**
- `src/data/agentPrompts.ts` → svuotato dei prompt completi, diventa registro: per ogni agente `{ id, coreFile, requiredVars, kbCategories, criticalProcedures[] }`.

**Refactor edge functions** (in ordine di criticità):
1. `improve-email`
2. `daily-briefing`
3. `ai-assistant`
4. `super-assistant`
5. `classify-email-response`
6. `contacts-assistant`
7. `cockpit-assistant`

Ognuna passa da prompt inline a `assemblePrompt({...})` + chiamata a `hardGuards` prima di mutazioni.

## Variabili runtime supportate

```text
{{user_alias}} {{user_company}} {{user_role}} {{user_sector}}
{{user_tone}} {{user_language}} {{current_date}} {{operator_id}}
{{recipient_count}} {{recipient_countries}}
{{available_tools}} {{kb_index}} {{kb_excerpts}}
{{active_plans}} {{recent_memories}}
```

## Iniezione selettiva (cautela #1 dell'utente)

Per i workflow critici, l'assembler NON si limita a citare la KB: estrae il blocco rilevante (primi ~800 char della entry) e lo include inline. Esempio per `improve-email`:
- prompt core (identità + guardrail)
- + estratto inline di `procedures/email-improvement-techniques`
- + indice KB completo per esplorazione
- + variabili risolte

Per workflow non critici, solo indice KB (l'AI usa `read_kb` se serve).

Configurazione in `agentPrompts.ts`:
```ts
"email-improver": {
  coreFile: "core/email-improver.md",
  kbCategories: ["procedures", "doctrine"],
  criticalProcedures: ["procedures/email-improvement-techniques"], // → injectExcerpts
  requiredVars: ["user_alias", "user_company", "user_tone"]
}
```

## Hard guards in codice (cautela #2 dell'utente)

Ogni tool con side-effect, prima di eseguire:
```ts
hardGuards.assertNotDestructive(action);
hardGuards.assertBulkCap(targets.length);
hardGuards.assertWhitelistedTable(tableName);
if (hardGuards.requiresApproval(toolId)) → status pending_approval
```
Indipendente da quello che dice il prompt. Se l'AI tenta DELETE o bulk > 5, il codice rifiuta a prescindere.

## Cosa NON tocco

- AI Query Engine (creato due step fa, già allineato)
- Logica business (DAL, mutations, RLS)
- Estetica UI
- File auth/comm critici (`check-inbox`, `email-imap-proxy`, `mark-imap-seen`)

## Ordine di esecuzione

1. `hardGuards.ts` (client + edge)
2. Migration KB (procedures + doctrine)
3. `assembler.ts` (client + edge)
4. 8 file core in `src/v2/agent/prompts/core/`
5. Refactor `agentPrompts.ts` a registro
6. Refactor edge functions una alla volta nell'ordine sopra
7. Smoke test: per ogni agente refactorato verifico riduzione lunghezza prompt e correttezza output

## Verifica post-implementazione

- `tsc --noEmit` pulito
- Riduzione prompt: target -70% righe per edge function
- Test funzionali per agente:
  - LUCA: "mostra partner US" (deve usare AI Query Engine)
  - Email Improver: variabili risolte, tecniche da KB applicate
  - Briefing: formato JSON corretto, niente hardcoded
- Test hard guards: tentativo DELETE da AI → bloccato dal codice anche se prompt non lo vieta esplicitamente
- Test fallback: KB irraggiungibile → agente continua con guardrail base senza crash

