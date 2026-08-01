---
name: Debt Budget Baseline 2026-04-28
description: Snapshot ratchet-down debito tecnico (any 496, eslint-disable 73, console 153). Ridurre solo, mai aumentare.
type: constraint
---
Baseline corrente in `scripts/debt-budget.js` (snapshot 2026-04-28):
- `any`: 496
- `eslint-disable`: 73
- `console.*`: 153

Regola: **ratchet-down only**. Quando una PR riduce un metric, abbassare la baseline allo snapshot post-PR. Mai alzare.
ESLint `no-console: error` e `react-hooks/rules-of-hooks: error` sono pinned esplicitamente.
