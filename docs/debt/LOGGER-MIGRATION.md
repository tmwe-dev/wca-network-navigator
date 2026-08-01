# Logger Migration Guide

## Existing Logger

The project has a structured logger at `src/lib/log.ts` (see ADR 0003).

```ts
import { createLogger } from "@/lib/log";
const log = createLogger("MyModule");

log.info("operation done", { jobId });
log.error("failed", { reason: err.message });
log.warn("retrying", { attempt: 3 });
log.debug("payload received", { size: data.length });
```

### Key features
- Structured JSON records with `timestamp`, `level`, `module`, `userId`, `sessionId`, `route`
- Pluggable sinks (`logConfig.addSink()`) for Sentry/Logtail/etc.
- Level filtering (`logConfig.setMinLevel("warn")` in production)
- Resilient: sink errors never crash the app

## Migration Pattern

Replace `console.*` calls with the structured logger. The `no-console` ESLint rule now enforces this.

### Example 1: `src/data/aiLabTestRuns.ts`

**Before:**
```ts
console.error("Failed to save test result:", error);
```

**After:**
```ts
import { createLogger } from "@/lib/log";
const log = createLogger("aiLabTestRuns");
// ...
log.error("Failed to save test result", { error: error instanceof Error ? error.message : String(error) });
```

### Example 2: `src/components/ai-control/AIAutomationDashboard.tsx`

**Before:**
```ts
console.log("Automation config loaded", config);
console.error("Failed to load automation config", err);
```

**After:**
```ts
import { createLogger } from "@/lib/log";
const log = createLogger("AIAutomationDashboard");
// ...
log.info("Automation config loaded", { config });
log.error("Failed to load automation config", { error: err.message });
```

### Example 3: `src/hooks/useWhatsAppExtensionBridge.ts`

**Before:**
```ts
console.warn("WhatsApp bridge timeout", { elapsed });
```

**After:**
```ts
import { createLogger } from "@/lib/log";
const log = createLogger("useWhatsAppExtensionBridge");
// ...
log.warn("WhatsApp bridge timeout", { elapsed });
```

## Authorized Console Users

These files are **exempt** from `no-console` (via inline disable with reason):
- `src/lib/log.ts` — the logger implementation itself
- `src/v2/bridge/internal-logger.ts` — bridge logger (avoids circular deps)

## Rules

1. Always use `createLogger("ModuleName")` — never bare `console.*`
2. Context must be a plain object, not a string
3. Don't log sensitive data (tokens, passwords, PII)
4. Use appropriate level: `debug` for dev-only, `info` for operations, `warn` for recoverable, `error` for failures
