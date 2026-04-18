

## Piano: AI Fix Fase 1 — 4 Bug Critici

Tutti e 4 i bug confermati sui file reali. Fix chirurgici, nessun refactoring.

### Fix #1 — `agent-autonomous-cycle/index.ts` riga 3
Aggiungere `loadWorkHourSettings` all'import esistente da `_shared/timeUtils.ts`. La funzione è già esportata correttamente (verificato in `timeUtils.ts`). Questo elimina il `ReferenceError` alla riga 182 che fa crashare il cron degli agenti autonomi a ogni ciclo.

### Fix #2 — `unified-assistant/index.ts` righe 10-13
Aggiungere `"deep-search"`, `"chat"`, `"mission-builder"` al `Set` `VALID_SCOPES`. Sblocca `useDeepSearchV2`, `useAgentChatV2`, `useMissionBuilderV2` che attualmente ricevono sempre HTTP 400 "Unknown scope".

### Fix #3 — `_shared/toolHandlersEnterprise.ts` (più chiamante)
Il problema è duplice:
1. **Riga 36**: rimuovere `const userId = "";` (variabile dummy module-scope che inquina la closure di `executeSearchKb`).
2. **Riga 156**: la firma `executeSearchKb(args)` non riceve userId, mentre il chiamante in `ai-assistant/toolExecutors.ts:309` (`search_kb: () => entH.executeSearchKb(args)`) ha `userId` disponibile nello scope ma non lo passa.

**Modifica chirurgica:**
- `toolHandlersEnterprise.ts` riga 36 → eliminare
- `toolHandlersEnterprise.ts` riga 156 → cambiare firma in `executeSearchKb(args: Record<string, unknown>, _userId: string)`
- `toolHandlersEnterprise.ts` riga 169 → cambiare `.eq("user_id", userId)` in `.eq("user_id", _userId)` (così il fallback testo userà l'userId reale del chiamante)
- `ai-assistant/toolExecutors.ts` riga 309 → `search_kb: () => entH.executeSearchKb(args, userId || "")`

Risultato: il fallback testuale del search_kb funziona quando il RAG embedding fallisce.

### Fix #4 — `src/hooks/useGlobalChat.ts` riga 190
Aggiungere `mode: "conversational"` al body inviato quando `state.mode === "conversational"`. Questo permette a `unified-assistant` di propagare la conversazionalità al `ai-assistant` engine (logica già presente nel forwarder), generando risposte brevi 3-4 frasi per il TTS invece di muri di testo operativi.

### File modificati (4 totali)
1. `supabase/functions/agent-autonomous-cycle/index.ts`
2. `supabase/functions/unified-assistant/index.ts`
3. `supabase/functions/_shared/toolHandlersEnterprise.ts` + `supabase/functions/ai-assistant/toolExecutors.ts`
4. `src/hooks/useGlobalChat.ts`

### Verifica post-fix
Grep su tutti i marker richiesti + TypeScript noEmit per confermare zero regressioni di tipo (in particolare la nuova firma di `executeSearchKb`).

