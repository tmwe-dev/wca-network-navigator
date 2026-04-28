---
name: Structured Logger + Edge Metrics
description: _shared/structuredLogger.ts JSON logging + tabella edge_metrics per errori/perf. createLogger(fn, ctx) → info/warn/error/critical/metric/time/flush. Bonificati silent catch in ai-assistant/toolLoopHandler e improve-email; eliminati `supabase: any` in tutti i toolHandlers (sostituiti con AnySupabaseClient).
type: feature
---

## Componenti
- **DB**: `public.edge_metrics` (function_name, event_type, severity, message, duration_ms, status_code, user_id, context jsonb, tags). RLS: solo admin in SELECT, scrittura solo via service role da edge functions.
- **Logger**: `supabase/functions/_shared/structuredLogger.ts` espone `createLogger(fn, baseCtx)` e helper `withLogger(fn, ctx, handler)` che fa flush automatico.
  - Output console: una linea JSON per evento (searchable in Supabase logs).
  - Persistenza: solo eventi `error/perf/metric/critical` finiscono in `edge_metrics` via batch insert in `flush()`.
  - Mai throw: errori del logger restano confinati al console.
- **Tipi**: `AnySupabaseClient` dal modulo `_shared/supabaseClient.ts` è il tipo canonico per parametri `supabase`. Vietato `supabase: any` nei nuovi handler.

## Regole
1. Tutti i nuovi handler di tool/edge function usano `createLogger("nome-fn", { userId })`.
2. Catch silenzioso = vietato. Minimo: `log.warn("operation_failed", { reason })`. Errori reali: `log.error("op_failed", err, { ctx })`.
3. Misurazione perf: usare `log.time("step", async () => ...)` o `log.metric("name", { duration_ms })`.
4. `await log.flush()` prima di ogni `return new Response(...)` significativa nelle edge function (entry points lunghi).
5. Per nuove funzioni handler con parametro `supabase`, importare `AnySupabaseClient` invece di `any`.

## File toccati (riferimento)
- new: `_shared/structuredLogger.ts` + `_shared/structuredLogger.test.ts` (4 test verdi)
- migrated: `agent-execute/toolHandlers/{messagingTools,workflowTools,dataTools,agentTools,configTools}.ts` + `ai-assistant/toolExecutors.ts` (eliminato `supabase: any`)
- refactored: `ai-assistant/toolLoopHandler.ts` (tipo `AssistantMessage`, no più `any` su result, log.warn/error nei catch)
- refactored: `improve-email/index.ts` (4 catch + completion metric con flush)
