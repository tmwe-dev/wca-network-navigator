
## Piano: Esecuzione completa di tutti i test del progetto

Eseguo in sequenza tutti i layer di test disponibili, raccogliendo report strutturati per ciascuno.

### Step 1 — Inventario test esistenti
Conteggio file test frontend (`*.test.ts(x)`), Deno (`*_test.ts`), E2E Playwright. Lettura `package.json` per script disponibili.

### Step 2 — Test frontend Vitest
- `npm test -- --run --reporter=verbose`
- Output: pass/fail/skipped, errori dettagliati, durata

### Step 3 — Coverage frontend
- `npm test -- --run --coverage`
- Verifica soglie: statements 20%, branches 15%, functions 20%, lines 20%

### Step 4 — Linter database Supabase
- Tool `supabase--linter`
- Output: warning RLS, policy mancanti, function search_path

### Step 5 — Security scan backend
- Tool `security--run_security_scan`
- Output: tabelle senza RLS, policy permissive, dati esposti

### Step 6 — Edge function tests Deno
- Tool `supabase--test_edge_functions` (tutte le funzioni)
- Include `platformTools_test.ts` e altri `*_test.ts`

### Step 7 — TypeScript compile check
- `npx tsc --noEmit`
- Output: errori di tipo, violazioni zero-any

### Step 8 — ESLint
- `npx eslint .` con config progetto
- Output: violazioni layer rules, no-restricted-imports

### Step 9 — Build production
- `npm run build`
- Output: bundle size, errori Vite, warning

### Step 10 — Playwright E2E (best effort)
- `npx playwright install --with-deps chromium && npx playwright test`
- Probabile skip in sandbox: documenterò il limite

### Step 11 — Report finale consolidato
Tabella riassuntiva per ogni layer:

```text
| Layer              | Esito | Pass | Fail | Durata | Note     |
|--------------------|-------|------|------|--------|----------|
| Vitest unit        |       |      |      |        |          |
| Coverage           |       |      |      |        | soglie   |
| Supabase linter    |       |   -  |   -  |        | warnings |
| Security scan      |       |   -  |   -  |        | findings |
| Edge func Deno     |       |      |      |        |          |
| TypeScript         |       |   -  |   -  |        | errors   |
| ESLint             |       |   -  |   -  |        | warnings |
| Build              |       |   -  |   -  |        | size     |
| Playwright E2E     |       |      |      |        | sandbox? |
```

### Strategia
- Step 2-9 **sequenziali** (condividono `node_modules`, console, memoria)
- Timeout esteso (300s) per Vitest e build
- **No fail-fast**: se uno step fallisce continuo gli altri, annoto nel report
- Tempo stimato totale: 8-12 minuti

### Output finale
- Tabella riassuntiva in chat
- File `/mnt/documents/test_report_2026-04-19.md` con dettagli completi per ogni layer (errori, warning, metriche)
- Prioritizzazione bug trovati: **critici** (build/test rotti) → **alti** (security/RLS) → **medi** (coverage/lint) → **bassi** (warning)
