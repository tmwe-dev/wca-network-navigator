

# Fix 172 Empty Catch Blocks with Structured Logging

## Scope

172 `catch {` blocks across ~80 files in `src/`. The project already has a structured logger (`src/lib/log.ts`) with `createLogger(module)` that produces JSON records.

## Strategy

Each empty catch falls into one of 3 categories, each gets a different fix:

### Category A: Silent swallow (no fallback, no comment) — ~90 occurrences
**Fix**: Add `(e)` parameter + `log.error("context", { error: e })` or `log.warn()` for non-critical paths.

```typescript
// Before
} catch {

// After
} catch (e) {
  log.error("failed to load X", { error: e });
}
```

### Category B: Fallback return (e.g. `catch { return []; }`) — ~35 occurrences
**Fix**: Add `(e)` + `log.warn()` before the return. The fallback stays.

```typescript
// Before
} catch { return []; }

// After
} catch (e) { log.warn("parse failed, using fallback", { error: e }); return []; }
```

### Category C: Already has comment like `/* intentionally ignored */` or `/* best-effort */` — ~30 occurrences
**Fix**: Add `(e)` parameter + `log.debug()` (lowest level, silent in prod). Keep the comment.

```typescript
// Before
} catch { /* intentionally ignored: best-effort cleanup */ }

// After
} catch (e) { log.debug("best-effort cleanup failed", { error: e }); /* intentionally ignored */ }
```

### Category D: In test files — ~15 occurrences
**Fix**: Leave as-is or add minimal `console.debug`. Tests intentionally trigger errors.

## Special cases

- **`src/lib/log.ts` itself** (5 catches): These MUST stay empty or use `console.error` — using the logger inside the logger would cause infinite recursion.
- **`src/lib/api/apiError.ts`**: Same — infrastructure code, use `console.error`.
- **JSON parse one-liners** (e.g. `try { return JSON.parse(x) } catch { return default }`): Add `log.debug` only, these are expected failures.

## File changes

~65 source files will be modified. Each file will:
1. Add `import { createLogger } from "@/lib/log"` if not already present
2. Add `const log = createLogger("moduleName")` if not already present  
3. Replace each `catch {` with `catch (e) { log.error/warn/debug(...) }`

## Test file updates

The `src/test/emptyCatches.test.ts` threshold can be lowered from 5 to 0 after this work.

## Risk

Low. Adding logging to catch blocks cannot break functionality. The error parameter `(e)` is captured but only passed to the logger. All existing behavior (fallback returns, toasts, state resets) is preserved.

## Execution

Will be done in batches by directory to keep changes reviewable:
1. `src/lib/` (infrastructure — ~15 files)
2. `src/hooks/` (~25 files)
3. `src/components/` (~35 files)
4. `src/pages/` (~8 files)
5. `src/test/` (skip or minimal)
6. Update emptyCatches test threshold to 0

