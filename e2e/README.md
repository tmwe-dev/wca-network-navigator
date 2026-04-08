# E2E (Playwright) — scaffold

Suite end-to-end pensata per **catturare il comportamento dei monoliti
residui prima del refactor** (FiltersDrawer 1300 LOC, BusinessCardsHub
1084 LOC, AddContactDialog 794 LOC, ImportWizard 625 LOC).

## Setup (una tantum)

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

## Esecuzione

```bash
# build statica + preview server
npm run build
npm run e2e            # ./e2e/**/*.spec.ts
npm run e2e:ui         # modalità interattiva
npm run e2e:report     # apre l'ultimo HTML report
```

## Convenzioni

- Ogni `*.spec.ts` corrisponde a **un flusso utente**, non a un singolo
  componente. Esempio: `import-wizard.spec.ts` copre l'intero percorso
  upload→preview→commit.
- I test devono restare **stabili durante lo splitting**: usare
  `getByRole`/`getByLabel` invece di selettori CSS sensibili alla DOM
  structure.
- I dati di test sono **deterministici**: usare `__seed` env-var o
  fixture in `e2e/fixtures/` invece di chiamare l'API reale.
- Tag `@smoke` per i test critici che girano su ogni PR; tag
  `@regression` per i test più lenti che girano nightly.

## Stato attuale

- ✅ `playwright.config.ts` con webServer su `vite preview`
- ✅ `home.smoke.spec.ts` — verifica che l'app monti senza errori
- ⏳ Suite per i monoliti: da scrivere quando si avvia il refactor

## Riferimenti

- Vol. II §9.3 "Test E2E e regression"
- Vol. I Ondata 6 (deferred) — refactor monoliti
- ADR-0003 logging strutturato (anche i test E2E loggano via createLogger)
