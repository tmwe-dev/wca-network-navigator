# Public JS Coverage Audit — 2026-04-14 (Updated)

## Scope

**49 JS files** in `public/` (17,593 LOC total) — browser extensions for Chrome, LinkedIn, WhatsApp, Email, RA, Partner-Connect.

**Option chosen: B** — keep files in `public/`, add separate `tsconfig` + ESLint config block.

## TypeScript Error Reduction

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| **Total errors** | **320** | **197** | **-123 (-38%)** |

### Errors by Category

| Error Code | Before | After | Description |
|-----------|--------|-------|-------------|
| TS2339 | 241 | 142 | Property does not exist on type |
| TS2451 | 10 | 10 | Cannot redeclare block-scoped variable |
| TS2322 | 8 | 8 | Type not assignable |
| TS2403 | 4 | 4 | Subsequent variable declarations type mismatch |
| TS2345 | 3 | 3 | Argument type mismatch |
| TS2591 | 19 | 0 | Cannot find name (CJS in ESM context) — **fixed via exclude** |
| TS2307 | 2 | 0 | Cannot find module — **fixed via exclude** |
| TS2304 | 3 | 0 | Cannot find name — **fixed via ambient** |
| Other | 30 | 30 | TS2740, TS2698, TS2554, TS2488, TS2353, TS1127, etc. |

### Top 10 Files by Error Count (remaining)

| File | Errors | Primary Issue |
|------|--------|---------------|
| email-extension/background.js | 38 | `unknown` from chrome.storage |
| partner-connect-extension/background.js | 18 | importScripts globals (typeof globalThis) |
| partner-connect-extension/cache.js | 17 | DOM Cache name conflict + unknown |
| linkedin-extension/ax-tree.js | 17 | object property access |
| partner-connect-extension/task-runner.js | 12 | object property access |
| partner-connect-extension/brain.js | 12 | unknown + object |
| partner-connect-extension/hydra-client.js | 8 | argument type mismatch |
| partner-connect-extension/pipeline.js | 5 | object property access |
| linkedin-extension/actions.js | 5 | unknown from chrome.storage |
| email-extension/storage-manager.js | 5 | spread/object literal |

### Residual Errors — Why Not Fixed This Round

| Category | Count | Reason |
|----------|-------|--------|
| `unknown` from chrome.storage.local.get | 73 | Requires per-file JSDoc `@type` casts on destructured results |
| `typeof globalThis` (importScripts modules) | 22 | Inherent to importScripts pattern; `declare var` causes TS2451 conflicts |
| `object` property access | 17 | Dynamic objects from parsed JSON/DOM; needs JSDoc or interface per callsite |
| DOM `Cache` name conflict | 16 | `const Cache` shadows global Cache; architectural — would need rename |
| `{}` empty object access | 8 | Uninitialized objects; needs JSDoc |
| TS2451 cross-file var redeclaration | 10 | Inherent to multi-script global scope model |
| Other (TS2322, TS2403, etc.) | 30 | Type mismatches requiring function signature changes |

## What Was Done

1. **Excluded `bridge/server.js`** (Node.js file) from `public/tsconfig.json` — eliminated 21 errors (TS2591 + TS2307)
2. **Created `public/types/ambient.d.ts`** with:
   - `importScripts()` declaration (TS2304)
   - `Window` augmentation for `__waH`, `loadTemplate`, `pauseTask`, `resumeTask`, `retryTask`
   - `Node.shadowRoot` augmentation (TreeWalker compat) — fixed 20 errors
   - `Element` augmentation (click, focus, disabled, value, etc.) — fixed 47 errors
   - `EventTarget` augmentation (value, result, transaction) — fixed 6 errors

## Configuration

- `public/tsconfig.json` — `checkJs: true`, `@types/chrome`, excludes `bridge/server.js`
- `public/types/ambient.d.ts` — ambient type declarations
- `eslint.config.js` — block for `public/**/*.js` with browser + webextensions globals
- `package.json` — `lint:public`, `typecheck:public` scripts
- `.github/workflows/ci.yml` — informational steps (non-blocking)

## Next Steps

1. Add JSDoc `@type` casts to `email-extension/background.js` for chrome.storage results (~37 errors)
2. Add JSDoc to `partner-connect-extension/cache.js` for cache entry types (~16 errors)
3. Consider per-extension tsconfigs to resolve importScripts global visibility (~22 errors)
4. Address `const Cache` DOM conflict in partner-connect (rename or namespace)
