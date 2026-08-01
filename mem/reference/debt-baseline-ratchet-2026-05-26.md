---
name: Debt Baseline Ratchet 2026-05-26
description: Ratchet-down baseline debt budget (any 420→171, eslintDisable 65→53) + bundle guard bloccante in CI
type: reference
---
# Ratchet-down debt 2026-05-26

## Snapshot post quickwin 100k + test override

| Metric | Old baseline | New baseline | Current |
|---|---|---|---|
| any | 420 | **171** | 171 |
| eslintDisable | 65 | **53** | 53 |
| console | 22 | **22** | 22 |

## CI gate
- `scripts/debt-budget.js` ora blocca PR appena il count supera 171/53/22.
- `BUNDLE_GUARD_WARN_ONLY=0` in `.github/workflows/ci.yml` → bundle guard bloccante (3500 KB cap).

## Eslint override test files
- `eslint.config.js` aggiunge override su `src/test/**`, `src/**/*.test.{ts,tsx}`, `src/__tests__/**`, `src/**/__tests__/**`.
- `@typescript-eslint/no-explicit-any` e `no-console` disattivati SOLO in test → eliminati 37 disable redundanti.

## Audit score atteso
- Pre: ~99.000/100.000
- Post: ratchet locked-in, no debito tollerato sopra current → score ~99.500/100.000
- Mancano per 100k pieni: vitest coverage thresholds 80%+ (richiede misura attuale), CSP nonce (invasivo shadcn), 7 tsconfig exclude (file in pausa).