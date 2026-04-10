

# AI Guardrails: CostTracker + ResponseValidator + invokeEdge Integration

## What Already Exists
- **RateLimiter** (`src/lib/api/rateLimiter.ts`): Fully functional token-bucket + circuit breaker. 689 tests passing. No changes needed.
- **Credits system**: DB-side `deduct_credits()` RPC + `useCredits` hook for balance display. Server handles actual billing.
- **invokeEdge**: Central wrapper for all 56 call-sites to edge functions.

## What's Missing
1. **CostTracker** — Client-side session budget tracking. Prevents runaway AI calls before they hit the server. Tracks cumulative cost per session, warns at thresholds, blocks at hard limit.
2. **ResponseValidator** — Validates AI response shapes before consumers process them. Catches malformed responses early with structured errors instead of runtime crashes.
3. **Integration** — Wire both into `invokeEdge` so all 56 call-sites get protection automatically.

## Plan

### File 1: `src/lib/api/costTracker.ts` (~80 LOC)

Session-scoped AI cost tracker:
- In-memory counter tracking `totalCredits`, `callCount`, `callsByFunction` per session
- Configurable `softLimit` (warning toast) and `hardLimit` (blocks call, throws `BudgetExceededError`)
- `trackCost(functionName, credits)` — called after successful AI responses
- `checkBudget()` — called before AI calls, throws if hard limit exceeded
- `getSessionStats()` — returns current session usage for UI/debugging
- `resetSession()` — manual reset
- Defaults: softLimit=500, hardLimit=1000 (configurable via `configureCostTracker`)

### File 2: `src/lib/api/responseValidator.ts` (~90 LOC)

Lightweight response shape validator:
- `validateResponse<T>(data, schema): T` where schema defines required/optional fields and types
- Schema format: `{ required: { field: "string" | "number" | "object" | "array" | "boolean" }, optional: { field: type } }`
- Throws `ResponseValidationError` (extends `ApiError` with code `SCHEMA_MISMATCH`) on failure, listing which fields failed
- Pre-built schemas exported for common AI responses: `outreachSchema`, `emailSchema`, `assistantSchema`
- Keeps it simple — no Zod dependency in client bundle, just runtime type checks

### File 3: Update `src/lib/api/invokeEdge.ts` (~15 LOC added)

Add guardrails to the central wrapper:
- Before call: `checkBudget()` — blocks if session hard limit reached
- After success: extract `_debug.credits_consumed` from response (if present) and call `trackCost()`
- After success: if a validator schema is registered for the function name, run `validateResponse()`
- New optional field in `InvokeEdgeOptions`: `responseSchema` for per-call validation
- All existing 56 call-sites get budget protection automatically, zero changes needed

### File 4: `src/test/costTracker.test.ts` (~50 LOC)

Tests: tracks credits, warns at soft limit, throws at hard limit, resets correctly.

### File 5: `src/test/responseValidator.test.ts` (~60 LOC)

Tests: passes valid shapes, rejects missing required fields, handles optional fields, returns typed data.

### File 6: Update `src/hooks/useCredits.ts` (~5 LOC added)

Expose `sessionStats` from `getSessionStats()` alongside the DB balance, so the UI can show both server balance and session consumption.

## Technical Notes

- **Zero breaking changes**: invokeEdge signature is backward-compatible (new fields are optional)
- **No new dependencies**: pure TypeScript runtime checks
- **Session-scoped**: CostTracker resets on page reload (intentional — server is source of truth for billing)
- **AI functions auto-tracked**: Any edge function returning `_debug.credits_consumed` gets tracked automatically

## Expected Impact
- 2 new files (~170 LOC), 2 test files (~110 LOC), 2 minor updates
- All 56 AI call-sites protected automatically via invokeEdge
- Prevents runaway AI costs client-side before server even sees the request

