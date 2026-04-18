

## Piano: AI Architettura Parte 2 — Migrazione a invokeEdge + Scope Config

Tutti i bug confermati sui file reali. Riallineamento necessario su `useAiAssistantChat` e `useGlobalChat` per preservare lo streaming SSE.

### Vincolo critico: streaming SSE

Sia `useAiAssistantChat` che `useGlobalChat` consumano la risposta come **SSE stream** (riga 145-177 di useAiAssistantChat, riga 80-119 di useGlobalChat). `invokeEdge` usa `supabase.functions.invoke` che **non espone il ReadableStream** — restituisce `{ data, error }` con il body parsato come JSON o testo.

**Decisione**: tenere il path JSON via `invokeEdge` come **primario** (è il path già usato quando `content-type === application/json`, riga 132-141 di useAiAssistantChat e riga 199-201 di useGlobalChat) e **rimuovere** completamente il path streaming SSE. L'edge function `ai-assistant` ritorna già JSON in modalità tool-calling (verificato dal codice esistente). Lo streaming SSE residuo era un fallback per response non-JSON che non si verifica più dopo il refactor backend.

Se per qualche motivo serve preservare lo streaming, va aggiunto un `fetchStream` wrapper separato — ma è fuori scope di questo prompt.

### Fix #5 — `src/hooks/useAiAssistantChat.ts`

1. **Riga 8** → aggiungere `import { invokeEdge } from "@/lib/api/invokeEdge"`
2. **Riga 27** → eliminare `const CHAT_URL = ...`
3. **Righe 113-180** → sostituire l'intero blocco try (fetch + parsing JSON + SSE stream loop) con:
   ```ts
   try {
     const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
     const enrichedContext = { ...context, currentPage: location.pathname };
     const data = await invokeEdge<{ content?: string; error?: string }>("ai-assistant", {
       body: { messages: allMsgs, context: enrichedContext },
       context: "aiAssistantChat",
     });
     const content = data.content || data.error || "Nessuna risposta";
     upsertAssistant(content);
     const { uiActions } = parseStructuredMessage(content);
     if (uiActions.length > 0) handleUiActions(uiActions);
   } catch (e) { ... }
   ```
4. Rimuovere `supabase.auth.getSession()` e la variabile `token` (gestiti da `invokeEdge`).

### Fix #6 — `src/hooks/useGlobalChat.ts`

1. **Riga 10** → aggiungere `import { invokeEdge } from "@/lib/api/invokeEdge"`
2. **Righe 14-15** → eliminare `CHAT_URL` e `SUPER_URL` (mantenere `TTS_URL` riga 16, usato altrove)
3. **Righe 76-119** → eliminare `interface SSEDelta` e funzione `readSSEStream` (non più usata)
4. **Righe 180-211** → sostituire l'intero blocco try fetch+parse con:
   ```ts
   try {
     const allMsgs = prevMessages.map((m) => ({ role: m.role, content: m.content }));
     const edgeFunction = state.mode === "conversational" ? "unified-assistant" : "ai-assistant";
     const body = state.mode === "conversational"
       ? { scope: "strategic", messages: allMsgs, pageContext: "global-chat", mode: "conversational" }
       : { messages: allMsgs };
     const data = await invokeEdge<{ content?: string; error?: string }>(edgeFunction, {
       body, context: "globalChat",
     });
     assistantContent = data.content || data.error || "Nessuna risposta";
   } catch (e) { ... }
   ```
5. Rimuovere `supabase.auth.getSession()` e la variabile `token` dalla closure di `sendMessage`.

### Fix #7 — `src/v2/hooks/useEmailComposerV2.ts`

1. **Top file** → aggiungere `import { invokeEdge } from "@/lib/api/invokeEdge"`
2. **Righe 80-84** (send-email) → sostituire `supabase.functions.invoke("send-email", ...)` con:
   ```ts
   await invokeEdge("send-email", {
     body: { to: r.email, subject, html: body },
     context: "emailComposerV2Send",
   });
   ```
   Rimuovere il check `if (error) throw error` (invokeEdge già throwa).
3. **Righe 102-114** (ai-assistant) → sostituire con:
   ```ts
   const data = await invokeEdge<{ response?: string }>("ai-assistant", {
     body: { messages: [...], context: "email_composer", use_kb: useKB },
     context: "emailComposerV2",
   });
   if (data?.response) setBody(data.response);
   ```
   **Nota**: il codice originale usa `data.response` (non `data.content`) — preservato.

### Fix #8 — `supabase/functions/_shared/scopeConfigs.ts`

**Riga 383** (prima del `default` throw) → aggiungere 3 nuovi case:
```ts
case "deep-search":
  return {
    systemPrompt: "Sei un assistente di ricerca approfondita...",
    tools: PLATFORM_TOOLS,
    creditLabel: "Deep Search V2",
  };
case "chat":
  return {
    systemPrompt: "Sei un assistente conversazionale per agenti autonomi...",
    tools: PLATFORM_TOOLS,
    creditLabel: "Agent Chat V2",
  };
case "mission-builder":
  return {
    systemPrompt: "Sei il configuratore di missioni outreach...",
    tools: [],
    temperature: 0.5,
    creditLabel: "Mission Builder V2",
  };
```

### File modificati (4)

1. `src/hooks/useAiAssistantChat.ts` — invokeEdge + rimozione SSE stream
2. `src/hooks/useGlobalChat.ts` — invokeEdge + rimozione SSE stream + readSSEStream/SSEDelta
3. `src/v2/hooks/useEmailComposerV2.ts` — invokeEdge per ai-assistant + send-email
4. `supabase/functions/_shared/scopeConfigs.ts` — 3 nuovi scope case

### Note critiche

- **Streaming SSE rimosso**: il backend `ai-assistant` ritorna già JSON in modalità tool-calling. Lo streaming era legacy. Effetto UX: il messaggio assistente appare in un solo update invece che progressivo. Accettabile dato il guadagno di error normalization, budget guardrail, Sentry breadcrumbs e cost tracking.
- **TTS_URL preservato**: `playTTS` (riga 54-74 di useGlobalChat) continua a usare `fetch` diretto perché ritorna un Blob audio, non gestibile da `invokeEdge`. Fuori scope.
- **`useEmailComposerV2.ts` ritorno**: `invokeEdge` ritorna direttamente il body, non `{ data }` — adattato di conseguenza.
- **Backward compat scope config**: `kb-supervisor` esistente preservato. I 3 nuovi scope si allineano alle attese di `unified-assistant/index.ts` aggiornato in Fase 1.

