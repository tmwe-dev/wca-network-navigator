# Public JS Coverage Audit — 2026-04-14

## Scope

**49 JS files** in `public/` (17,593 LOC total) — browser extensions for Chrome, LinkedIn, WhatsApp, Email, RA, Partner-Connect.

**Option chosen: B** — keep files in `public/`, add separate `tsconfig` + ESLint config block.
**Motivation**: these are browser extensions served as static assets. Moving to `src/` would require a build pipeline and break the extension manifest loading model (`content_scripts`, `background.service_worker`).

## ESLint Results

| Rule | Count | Severity |
|------|-------|----------|
| `no-var` | 987 | error |
| `no-unused-vars` | 113 | warning |
| `prefer-const` | 5 | error |
| `eqeqeq` | 1 | error |
| **Total** | **1,106** | 993 errors, 113 warnings |

> 984 errors are auto-fixable with `--fix` (all `no-var` → `let`/`const`).

## TypeScript (`checkJs`) Results

| Error Code | Count | Description |
|-----------|-------|-------------|
| TS2339 | 241 | Property does not exist on type |
| TS2591 | 19 | Cannot find name (CJS in ESM context) |
| TS2451 | 10 | Cannot redeclare block-scoped variable |
| TS2322 | 8 | Type not assignable |
| TS2403 | 4 | Subsequent variable declarations type mismatch |
| TS2345 | 3 | Argument type mismatch |
| TS2304 | 3 | Cannot find name |
| TS2740 | 2 | Missing properties |
| TS2698 | 2 | Spread types may only be created from object types |
| TS2554 | 2 | Expected N arguments, got M |
| TS2488 | 2 | Type must have Symbol.iterator |
| TS2353 | 2 | Object literal may only specify known properties |
| TS2307 | 2 | Cannot find module |
| TS1127 | 2 | Invalid character |
| Other | 4 | TS2769, TS2741, TS2739, TS2362/TS2363 |
| **Total** | **306** | |

## Configuration Added

- `public/tsconfig.json` — `checkJs: true`, `@types/chrome`
- `eslint.config.js` — new block for `public/**/*.js` with browser + webextensions globals
- `package.json` — `lint:public`, `typecheck:public` scripts
- `.github/workflows/ci.yml` — informational steps (non-blocking, `|| true`)

## Next Steps

1. Run `eslint public/ --fix` to auto-fix 984 `no-var` errors
2. Address TS2339 (241 occurrences) — mostly missing type annotations on dynamic objects
3. Fix TS2591 (19) — likely `require()` calls that should be ESM imports or `importScripts()`
