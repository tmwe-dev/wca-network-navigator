## Obiettivo
Pop-up "Trace Console" attivabile da ogni pagina del V2 che mostra in tempo reale **tutto il traffico frontend** (chiamate AI, edge function, query Supabase) con vista doppia:
- **Tab Trace** — eventi reali in ordine cronologico, filtrabili
- **Tab Checklist** — per i flussi critici (es. "send email", "ai-query Command", "agent-loop") la lista dei passi attesi confrontata con quelli effettivamente eseguiti, con verde/rosso/mancante

I dati persistono nella nuova tabella `ai_runtime_traces` per consultazione retrospettiva e cross-utente (admin).

---

## Architettura

### Layer di raccolta (interceptor centralizzati)
Un singolo `traceCollector` (singleton in memoria) intercetta a livello frontend:

1. **invokeAi()** — già choke point unico per AI (Charter). Aggiungo emit di evento `ai.invoke` con scope, source, model, durata, status.
2. **invokeEdge()** — choke point per edge function non-AI. Emit `edge.invoke`.
3. **supabase client wrapper** — patch leggera su `supabase.from(...)` che intercetta `.select/.insert/.update/.delete/.upsert/.rpc` e emette `db.query` (table, op, rowCount, durata, err). Implementato come Proxy attorno al client esistente, senza toccare `client.ts`.
4. **`window.dispatchEvent('trace:event', ...)`** — API pubblica per emit manuali da hook custom (es. journalist gate, hard guards lato client).

Ogni evento ha lo schema:
```
{ id, ts, type, scope, source, route, status, duration_ms, payload_summary, error?, request_id, correlation_id }
```

`correlation_id` (UUID) raggruppa tutto ciò che parte da una singola azione utente: viene impostato all'inizio di un'invocazione AI/edge e propagato negli eventi figli (es. l'`ai.invoke` `agent-loop` con la sua sequenza di `db.query` correlate).

### Persistenza
Nuova tabella **`ai_runtime_traces`** (insert-only):
- `id uuid pk`, `user_id uuid`, `correlation_id uuid`, `ts timestamptz`, `type text`, `scope text`, `source text`, `route text`, `status text`, `duration_ms int`, `payload_summary jsonb`, `error jsonb`, `created_at`
- Index su `(user_id, ts desc)` e `(correlation_id)`
- RLS: SELECT solo own + admin via `has_role`; INSERT only own
- Retention: cron job DB cancella > 7 giorni (rolling window)

Flush DB **batched** (max 25 eventi o 5s) per non spammare.

### UI

**Componente `TraceConsole`** mountato in `App.tsx` come singleton globale. Hotkey `Ctrl+Shift+T` per toggle. Stato persistito in `localStorage` (open/closed, position, filtri).

```text
┌─ Trace Console  [×] [⚙️] [📌pin] ┐
│ [Trace] [Checklist] [Filters]   │
├─────────────────────────────────┤
│ 18:52:01.234 ai.invoke ai-query │
│   ↳ scope=command duration=1.2s │
│ 18:52:01.512 db.query partners  │
│   ↳ select count=1 230ms        │
│ 18:52:02.401 edge.invoke send-..│
│   ↳ status=200 1.8s             │
└─────────────────────────────────┘
```

**Tab Checklist** — selezioni un `correlation_id` e vedi:
```text
Flow: send-email
✅ journalist_review (522ms)
✅ promptSanitizer
✅ generate-email
❌ post-send-pipeline  ← MANCANTE
✅ smtp.send
```

Le checklist sono definite in un file statico **`src/v2/observability/flowDefinitions.ts`** che mappa flow → step attesi (es. lista di `(type, scope|source)` da matchare nel buffer eventi). Nuovi flussi si aggiungono qui senza toccare il resto.

### Filtraggio
- per `type` (ai/edge/db)
- per `scope` (es. solo `command`, solo `agent-loop`)
- per `route` (eventi sulla route corrente)
- search testuale su payload

### Performance / sicurezza
- Eventi DB **batchati** + payload summary troncato (max 1KB JSON)
- Body request/response **non** salvati grezzi: solo summary (table, op, count, status)
- Toggle "Pause recording" per congelare il buffer durante debug
- In produzione abilitato solo per ruoli admin/operator (RBAC check), gli altri utenti vedono il toggle disabilitato.

---

## Dettagli tecnici

### File da creare
```
src/v2/observability/
  traceCollector.ts          ← singleton bus + buffer + flusher
  traceTypes.ts              ← schema TS + Zod
  flowDefinitions.ts         ← checklist statiche per flow
  supabaseTraceProxy.ts      ← Proxy attorno al supabase client
  TraceConsole.tsx           ← UI floating + tabs
  TraceConsoleTrigger.tsx    ← bottone fisso bottom-right
  hooks/useTraceBuffer.ts    ← React subscription al collector

src/data/runtimeTraces.ts    ← DAL insert/select trace

supabase/migrations/<ts>_ai_runtime_traces.sql
```

### File da modificare (minimo invasivo)
- `src/v2/io/edge/invokeAi.ts` — wrap chiamata, emit evento prima/dopo
- `src/lib/api/invokeEdge.ts` — stesso pattern
- `src/integrations/supabase/client.ts` ⚠️ FILE PROTETTO → uso wrapper esterno: `src/v2/observability/supabaseTraceProxy.ts` re-esporta `supabase` patchato; chi vuole tracciare importa dal nuovo path. Per coprire tutto senza forzare migrazione, monto un **monkey-patch one-shot** in `App.tsx` che avvolge i metodi del client già istanziato.
- `src/App.tsx` — mount di `<TraceConsole />` e init `traceCollector`

### Migration SQL
```sql
CREATE TABLE ai_runtime_traces (...);
ALTER TABLE ai_runtime_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select" ...;
CREATE POLICY "admin select all" ...;
CREATE POLICY "owners insert" ...;
CREATE INDEX ...;
-- cron retention 7gg via pg_cron
```

### Checklist flow definite al lancio (estendibili)
1. `send-email` (direct) → journalist + promptSanitizer + edge `send-email` + post-send + DB activity insert
2. `ai-query Command` → planner + executor + (opzionale) commenter + DB select sui table dichiarati
3. `agent-loop` → persona load + capabilities load + operative prompts load + LLM call + tool execution
4. `process-email-queue` (solo lato frontend trigger) → enqueue + cron pickup notification
5. `deep-search` → quality preset + tool sequence

---

## Cosa NON faccio in questa iterazione
- Tracing **server-side** dei step interni alle edge function (es. dentro `agent-execute`): per quello c'è già `edge_metrics` + `structuredLogger`. Aggiungo solo la riga `correlation_id` al header passato dal frontend, così in futuro si può fare un join lato server.
- UI di analytics aggregate (pie chart per scope ecc): vediamo l'esigenza dopo aver raccolto qualche giorno di dati.

---

## Verifica
1. Aprire pagina Command, fare query "quanti contatti" → deve apparire correlation_id con ai-query-planner + ai-comment + db.select su contacts.
2. Mandare email da SendEmailDialog → checklist tab mostra i 4 step verdi (sanitize, journalist, send-email, post-send).
3. Reload pagina con `Ctrl+Shift+T` → console riappare aperta nella stessa posizione.
4. Login con utente non-admin → trigger console disabilitato.
5. Verifica DB: `select count(*) from ai_runtime_traces` cresce; cron pulizia testato manualmente con backdated row.