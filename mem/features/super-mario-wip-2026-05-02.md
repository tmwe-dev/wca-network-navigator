---
name: Super Mario AI Gateway WIP 2026-05-02
description: Stato implementazione Super Mario (AI Gateway unico per Command). Migration DB completata, edge function parzialmente scritta.
type: feature
---

# Super Mario — stato implementazione (WIP 2026-05-02)

Piano completo approvato in `.lovable/plan.md`.

## ✅ Completato

### DB (migration applicata)
- Tabella `super_mario_identities` (RLS: read authenticated, write admin) + trigger updated_at con search_path.
- Tabella `conversation_summaries` (memoria narrativa versionata, coverage from..to esplicita).
- Tabella `super_mario_invocations` (audit redatto, retention 30gg via expires_at + funzione `cleanup_super_mario_invocations()`).
- `operative_prompts`: aggiunti `deprecated_at`, `deprecated_reason`. Tutti i record `context='command'` soft-deprecati (NON cancellati).
- Seed identity `command-director` (Direttore Operativo) inserita via UPSERT idempotente.

### Edge function `supabase/functions/super-mario/` (parziale)
File già scritti:
- `runtimeContract.ts` — schema risposta JSON obbligatorio + hard guards descrittivi + `isSuperMarioResponse` validator.
- `identityLoader.ts` — cache 5 min + fallback hardcoded.
- `toolCatalog.ts` — descrittori tool con `risk_level` (read/write/send/destructive) + `renderToolCatalog()` + `findTool()`.
- `memoryAssembler.ts` — 5 sezioni MEMORY (NARRATIVE_SUMMARY, RECENT_TURNS, LAST_TOOL_RESULT, OPERATOR_MEMORY, CURRENT_USER_REQUEST) + helper `summarizeToolResult`.
- `summarizer.ts` — `ensureSummaryCoverage()` con cache (REFRESH_EVERY_N_TURNS=5) + chiamata diretta gateway con `gemini-2.5-flash-lite`.

## ⏳ Da completare

### Edge function (file ancora da creare)
- `hardGuards.ts` — validazione runtime (no DELETE/DROP, max 5 tool chain, sanitize input).
- `preflightAudit.ts` — blocca se identity assente/scope invalido/budget sforato.
- `postflightAudit.ts` — valida `SuperMarioResponse` schema, tool referenziati nel catalog, risk_level coerente.
- `auditLogger.ts` — SHA256 hash + PII redaction + truncate 8KB + insert su `super_mario_invocations`.
- `index.ts` — orchestrator <150 LOC che assembla tutto e chiama il gateway con `response_format: json_object`.

### Frontend
- `src/v2/ai/superMario.ts` — wrapper `invokeAi`-compliant (scope `command`, source obbligatorio).
- Aggiungere `"super-mario"` a `AI_FUNCTION_NAMES` in `src/lib/ai/invokeAi.ts`.
- Cablaggio in `useCommandSubmit.ts`: sostituire `aiBridge.getAiComment`, `useFastLane`, `planExecution` → `superMario.invoke()`.
- Eliminare: `useResultCommentary`, `lastQueryResultContext`, regex `isProceedIntent`/`isElliptical`/`looksLikeSimpleQuery` in `usePromptAnalysis`.
- Aggiornare `tools/registry.ts` con campo `risk_level` per ciascun tool.

## Note tecniche

- Lo scope `command` esiste già in `ai_scope_registry` (enforcement `warn`).
- Gli operative_prompts vecchi restano in DB per audit/rollback (filtrabili via `WHERE is_active = true AND deprecated_at IS NULL`).
- Compatibilità: `ai-assistant` resta operativo per outreach/email/agent-execute. Super Mario è SOLO per Command in fase 1.
- Il modello principale userà `google/gemini-3-flash-preview` (default Lovable AI). Summarizer usa flash-lite per costo.
- Identity in DB modificabile da admin senza redeploy. Runtime contract immutabile (codice).
