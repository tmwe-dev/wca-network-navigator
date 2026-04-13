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

## Deploy

Edge Functions deploy automatically via Lovable when changes are pushed.
