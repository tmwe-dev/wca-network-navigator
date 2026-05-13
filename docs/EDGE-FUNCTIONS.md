# Edge Functions Development Guide

## Standard Structure

Every Edge Function MUST follow this pattern:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

Deno.serve(async (req) => {
  // 1. CORS preflight
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("function-name");

  try {
    // 2. Auth check
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;
    metrics.userId = auth.userId;

    // 3. Input validation
    const body = await req.json();
    // Validate with Zod or manual checks...

    // 4. Business logic
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ... your logic here ...

    // 5. Success response
    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    logEdgeError("function-name", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers,
    });
  }
});
```

## Shared Modules

| Module | Purpose |
|--------|---------|
| `cors.ts` | Dynamic CORS headers with origin whitelist |
| `authGuard.ts` | JWT validation via getClaims |
| `monitoring.ts` | Structured JSON logging with metrics |
| `securityHeaders.ts` | Defense-in-depth HTTP headers |
| `rateLimiter.ts` | Token bucket rate limiting |
| `inputValidator.ts` | Input sanitization utilities |
| `handleEdgeError.ts` | Typed error responses with `edgeError()` |
| `csrfProtection.ts` | Origin validation |

## Rules

1. **Never** use `as any` — define interfaces for all data shapes
2. **Always** include CORS headers in ALL responses (including errors)
3. **Always** use `catch (error: unknown)` with proper type narrowing
4. **Never** hardcode secrets — use `Deno.env.get()`
5. **Never** modify reserved schemas (auth, storage, realtime)
6. Keep files under 200 LOC — extract to shared modules
7. Use `edgeError()` for consistent error response format

## Cron Functions

| Function | Schedule | Purpose |
|----------|----------|---------|
| `dispatch-integrity-check` | Daily 03:15 UTC | Verifies coherence between channel_messages, activities, and partner touches |
| `agent-prompt-refiner` | Weekly Mon 04:00 UTC | AI-driven prompt improvement suggestions |
| `ai-test-runner` | Daily 03:00 UTC | Runs prompt test suites and records results |
| `funnemail-eval-runner` | Weekly Mon 05:00 UTC | Evaluates classify-inbound-message against 50 annotated test cases |

All cron functions authenticate via `x-cron-secret` from Vault (never hardcoded).

## Key Function Categories

**AI Orchestration** (20+): agent-execute, agent-loop, agent-simulate, agent-autonomous-cycle, agent-autopilot-worker, agent-task-drainer, agentic-decide, ai-gateway-micro, ai-assistant, ai-deep-search-helper

**Email Pipeline** (15+): check-inbox, classify-inbound-message, classify-email-response, generate-email, improve-email, send-email, analyze-email-edit, apply-email-rules, funnemail-eval-runner

**Enrichment** (10+): enrich-partner, batch-enrichment-worker, calculate-partner-quality, calculate-lead-scores, analyze-partner, scrape-wca-member

**Prompt Lab** (5): agent-prompt-refiner, ai-test-runner, prompt-test-evaluator, ai-arena-suggest

**Monitoring** (5): ai-tracking-healthcheck, ai-monitor, dispatch-integrity-check, alert-router

## Deploy

Edge Functions deploy automatically via Lovable when changes are pushed to GitHub. Manual deploy via `supabase functions deploy <name>`.
