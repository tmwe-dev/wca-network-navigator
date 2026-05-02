
# Super Mario — AI Gateway operativo per Command (v2)

## Filosofia

Super Mario non è un altro prompt. È il **gateway operativo unico** tra Command e AI.

- Il **modello** riceve identità, memoria, strumenti e regole tecniche → interpreta il contesto e propone la prossima azione.
- Il **codice** valida scope, sicurezza, schema, tool e limiti → governa l'esecuzione.
- La **memoria** viene assemblata in un unico blocco narrativo versionato.
- Ogni **invocazione** viene auditata prima (preflight) e dopo (postflight).

> AI intelligente, governata dal codice. Mai sovrana sulle azioni sensibili.

## Architettura

```text
Command UI ── superMario.invoke({ scope, userTurn, conversationId }) ──┐
                                                                       ▼
┌──────────────────── Edge: super-mario ────────────────────────────────┐
│                                                                       │
│  1. IDENTITY (DB, modificabile)                                       │
│     loadIdentity('command-director') ◄── super_mario_identities       │
│                                                                       │
│  2. RUNTIME CONTRACT (codice, immutabile)                             │
│     - schema risposta obbligatorio                                    │
│     - formato tool_calls                                              │
│     - limiti chain                                                    │
│                                                                       │
│  3. TOOL CATALOG (codice)                                             │
│     loadToolCatalog(scope) → ogni tool ha:                            │
│       name, description, when_to_use, json_schema,                    │
│       risk_level, requires_confirmation, scope                        │
│                                                                       │
│  4. MEMORY (assembler unico)                                          │
│     conversation_context = {                                          │
│       NARRATIVE_SUMMARY   (da conversation_summaries, versionato),    │
│       RECENT_TURNS        (verbatim, ultimi 10),                      │
│       LAST_TOOL_RESULT    (strutturato),                              │
│       OPERATOR_MEMORY     (mem L1-L3),                                │
│       CURRENT_USER_REQUEST                                            │
│     }                                                                 │
│                                                                       │
│  5. HARD GUARDS (codice, non bypassabili)                             │
│     - no DELETE/DROP/TRUNCATE                                         │
│     - max 5 tool chain                                                │
│     - promptSanitizer su input                                        │
│     - PII redaction                                                   │
│     - rispetto scope                                                  │
│                                                                       │
│  6. PREFLIGHT AUDIT                                                   │
│     blocca se: identity assente, scope invalido, catalog vuoto,       │
│     memory block assente, user turn assente, budget sforato,          │
│     prompt injection HIGH, schema tool incoerente                     │
│                                                                       │
│  7. CALL Lovable AI Gateway (response_format: json_object)            │
│                                                                       │
│  8. POSTFLIGHT AUDIT                                                  │
│     - schema risposta valido?                                         │
│     - tool_calls referenziano tool reali?                             │
│     - risk_level coerente con scope?                                  │
│     - log su super_mario_invocations (redatto)                        │
│                                                                       │
│  9. RETURN { message, tool_calls, requires_confirmation, traceId }    │
└───────────────────────────────────────────────────────────────────────┘
                                ▼
Frontend: esegue tool_calls SOLO se risk_level=read; altrimenti chiede conferma.
```

## Schema risposta unico (obbligatorio)

Il modello risponde SEMPRE in questo schema (validato in postflight):

```json
{
  "message": "Ho trovato 5 partner a Marsa. Vuoi che prepari la bozza per tutti?",
  "tool_calls": [
    { "tool_name": "compose-email", "arguments": {...}, "trace_id": "..." }
  ],
  "reasoning_summary": "L'utente si riferisce all'ultimo risultato filtrato su Marsa.",
  "needs_user_confirmation": true,
  "memory_updates": [],
  "warnings": []
}
```

`reasoning_summary` non viene mostrato all'utente — serve per audit e per alimentare il prossimo `NARRATIVE_SUMMARY`.

## Identity in DB (modificabile)

Tabella `super_mario_identities`, una riga per scope. Per `command-director`:

```text
RUOLO
Sei il direttore operativo del CRM WCA. L'utente è il responsabile commerciale.

COMPORTAMENTO
- Aiuti l'utente a ragionare, decidere e agire.
- Usa i tool quando servono.
- Se il riferimento è chiaro, agisci.
- Se manca contesto essenziale, chiedi.
- Italiano, diretto, collaborativo.

MEMORIA
Ricevi sempre: NARRATIVE_SUMMARY, RECENT_TURNS, LAST_TOOL_RESULT, OPERATOR_MEMORY, CURRENT_USER_REQUEST.
Usali per capire i riferimenti ("questi", "quelli", "marsa", "i 5") senza chiedere conferma.
```

Nessun "MAX 30 parole", nessun "DEVI proporre", nessuna lista di azioni forzate.

## Runtime Contract (in codice, immutabile)

File `runtimeContract.ts`. Iniettato dopo l'identity:

```text
RISPONDI SEMPRE in JSON valido conforme allo schema fornito.
- tool_calls[].tool_name DEVE esistere nel TOOL CATALOG.
- Se un tool ha risk_level != "read", imposta needs_user_confirmation: true.
- Max 5 tool_calls per turno.
- Nessun testo fuori dal JSON.
```

## Tool Catalog con risk_level

Ogni tool nel registry dichiara:

```ts
{
  name: 'search-partners',
  description: '...',
  when_to_use: '...',
  json_schema: { ... },
  risk_level: 'read' | 'write' | 'send' | 'destructive',
  requires_confirmation: boolean,
  scope: 'command'
}
```

Politica esecuzione client-side:
- `read` → esecuzione diretta.
- `write` / `send` → conferma utente obbligatoria (UI approval).
- `destructive` → vietato (rifiutato in postflight).

## Memoria narrativa versionata

Tabella `conversation_summaries`:
- `id`, `conversation_id`, `from_message_index`, `to_message_index`, `summary`, `model`, `summary_version`, `created_at`.

Generata da `gemini-2.5-flash-lite` quando i turni superano 10. Coverage esplicita:
> *Summary covers messages 1–35. Recent verbatim covers messages 36–45.*

Nessun buco, nessuna riscrittura magica.

## Audit log redatto

Tabella `super_mario_invocations`:

```text
trace_id, conversation_id, scope, model,
prompt_tokens, completion_tokens, latency_ms,
final_prompt_hash,           -- SHA256
final_prompt_redacted_8kb,   -- PII rimossa, troncato 8KB
response_summary,            -- non response completa
tool_calls_json,
audit_warnings JSONB,
error_code,
created_at,
expires_at                   -- now() + 30 giorni
```

Cron giornaliero elimina record con `expires_at < now()`. Mai prompt pieno in chiaro.

## Cleanup prompt vecchi (soft, non DELETE)

Migration:
```sql
ALTER TABLE operative_prompts
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecated_reason text;

UPDATE operative_prompts
SET is_active = false,
    deprecated_at = now(),
    deprecated_reason = 'Replaced by super_mario_identities (command scope)'
WHERE context = 'command';
```

I 30 record restano per audit/rollback. Cleanup fisico solo dopo backup esplicito.

## Cosa cambia nel codice

### Frontend (Command)
**Sostituiti**:
- `aiBridge.getAiComment` → `superMario.invoke()`
- `useFastLane` → `superMario.invoke({ intent: 'auto' })`
- `planExecution` → `superMario.invoke({ intent: 'plan' })`

**Eliminati**:
- `useResultCommentary` (Super Mario commenta direttamente)
- `lastQueryResultContext` (entra in `LAST_TOOL_RESULT`)
- regex `isProceedIntent`, `isElliptical`, `looksLikeSimpleQuery`
- `localResultFormatter`

**Conservati**:
- `useConversation` (DB persistence dei turni)
- `tools/` registry (executor client + risk_level + json_schema)
- UI canvas / approval modal

### Backend (nuovo edge `super-mario`)
- `index.ts` (orchestrator <150 LOC)
- `identityLoader.ts` (cache 5 min)
- `runtimeContract.ts`
- `toolCatalog.ts`
- `memoryAssembler.ts` (5 sezioni)
- `summarizer.ts` (chiama gemini-flash-lite, scrive `conversation_summaries`)
- `hardGuards.ts`
- `preflightAudit.ts`
- `postflightAudit.ts` (valida schema risposta, risk_level, tool referenziati)
- `auditLogger.ts` (redaction + hash + truncate)

### Database (migration)
1. Tabella `super_mario_identities` (scope unique, content, is_active, updated_at).
2. Tabella `conversation_summaries`.
3. Tabella `super_mario_invocations` (con `expires_at` + cron cleanup).
4. Soft-deprecation degli `operative_prompts` con `context='command'`.
5. Seed: 1 riga `command-director` in `super_mario_identities` con identity riscritta.

## Compatibilità

- `ai-assistant` resta operativo per outreach, email, agent-execute.
- Super Mario è **solo per Command** in questa fase.
- Migrazione futura degli altri scope = aggiungere righe in `super_mario_identities` + estendere `toolCatalog`.

## Cosa NON facciamo in questa fase

- Streaming (resta non-streaming come oggi).
- Tool execution server-side (resta client-side, con risk gating).
- Migrazione di outreach/email su Super Mario.

## Validazione

1. **Test edge**: identity caricata, hard guards bloccano DELETE, audit log redatto correttamente, schema risposta validato.
2. **Test E2E conversazione**: "trova partner Malta" → "quanti a Marsa" → "prepara email per quelli" → il modello risolve i riferimenti senza regex client-side, e per "prepara email" chiede conferma (risk=write).
3. **Test memoria**: dopo 15 turni, `conversation_summaries` contiene 1 riga che copre messages 1-10, RECENT_TURNS contiene 11-15, nessun buco.
4. **Test audit**: query su `super_mario_invocations` mostra `final_prompt_hash` e versione redatta, mai prompt in chiaro con email/telefoni.
5. **Test risk gating**: tool `destructive` viene rifiutato in postflight; tool `send` triggera `needs_user_confirmation: true`.

## File toccati (stima)

- **Nuovi**: 10 file in `supabase/functions/super-mario/`, 1 migration, 1 file `src/v2/ai/superMario.ts` (client wrapper).
- **Modificati**: `useCommandSubmit.ts`, `useFastLane.ts`, `usePlanExecution.ts`, `aiBridge.ts` (svuotato), `CommandPage.tsx`, tools/registry (aggiunge `risk_level`).
- **Eliminati**: `useResultCommentary.ts`, `lastQueryResultContext.ts`, regex in `usePromptAnalysis.ts`.
- **DB**: 30 record `operative_prompts` deprecati (soft), 1 record `super_mario_identities` creato, 3 nuove tabelle.

## Diff filosofico vs v1 del piano

| Aspetto | v1 | v2 (questa) |
|---|---|---|
| Cleanup prompt | `DELETE FROM` | `UPDATE is_active=false` |
| Audit log | `final_prompt` 8KB in chiaro | `hash` + `redacted_8kb` + retention 30gg |
| Memoria narrativa | resume sovrascritto | `conversation_summaries` versionato con coverage esplicita |
| Schema risposta | testo libero | JSON schema unico obbligatorio |
| Tool risk | non gestito | `risk_level` + `requires_confirmation` per ogni tool |
| Identity vs contratto | tutto in DB | identity in DB, runtime contract immutabile in codice |
| Filosofia AI | "il modello decide" | "AI propone, codice valida ed esegue" |
