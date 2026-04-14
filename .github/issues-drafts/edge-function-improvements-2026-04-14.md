# Edge Functions — Medium/Low Priority Issues

Filed from audit 2026-04-14.

## HIGH: Add Zod Input Validation

**All 76 edge functions** lack schema-based input validation. Priority order:

1. **Financial** (`buy-credits`, `consume-credits`, `create-checkout`) — prevent malformed payment requests
2. **Write-heavy** (`save-wca-contacts`, `save-ra-prospects`, `process-ai-import`) — validate batch payloads
3. **AI generation** (`ai-assistant`, `generate-email`, `generate-outreach`) — validate prompt structure
4. **Credential storage** (`save-linkedin-cookie`, `save-ra-cookie`, `save-wca-cookie`) — validate cookie format

**Pattern to follow:**
```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
const BodySchema = z.object({ cookie: z.string().min(10).max(10000) });
const parsed = BodySchema.safeParse(body);
if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
```

## MEDIUM: Add AbortController Timeouts

~15 functions call external APIs without timeout. Add:
```typescript
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 30_000);
try { await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(timer); }
```

Priority: `ai-assistant`, `agent-execute`, `elevenlabs-tts`, `parse-profile-ai`

## MEDIUM: Rate Limiting

AI-heavy functions should adopt `_shared/rateLimiter.ts`:
- `ai-assistant` — 15 req/min per user
- `generate-email` / `generate-outreach` — 20 req/min per user
- `elevenlabs-tts` — 10 req/min per user
- `agent-execute` — 5 req/min per user

## LOW: Idempotency Keys

Financial write operations should accept `Idempotency-Key` header:
- `buy-credits`
- `consume-credits`
- `send-email`
- `create-checkout` (Stripe handles this natively)

## LOW: Extension JWT Migration

Browser extensions should be upgraded to pass real user JWT tokens:
- `public/linkedin-extension/auth.js` — use stored session token
- `public/ra-extension/background.js` — use stored session token
- `public/partner-connect-extension/brain.js` — use stored session token

Currently accepted via `extensionAuth.ts` anon-key fallback.

---

*Filed: 2026-04-14*
