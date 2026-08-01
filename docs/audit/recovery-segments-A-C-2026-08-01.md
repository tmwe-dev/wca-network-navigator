# Recovery program — Segmenti A/B/C (2026-08-01)

Baseline macchina: `docs/audit/baseline-755abe88e2.json` (`npm run baseline[:full]`).
Matrice rotte: `docs/audit/route-matrix-2026-08-01.json`.

## A — Baseline + install deterministico
- Toolchain: Node v22.22.0, npm 10.9.4, engines `>=20`.
- Repo: 4305 file tracciati, src 2509 file / 329.032 LOC, 394 file di test,
  149 Edge Function / 87.177 LOC, 416 migrazioni / 25.186 LOC SQL.
- package.json ↔ package-lock: **0 problemi** (missing-in-lock, version-mismatch,
  missing-installed-entry tutti a zero). Le 3 dipendenze mancanti erano già
  riallineate; nessuna dipendenza rimossa in questo segmento.
- `npm ci` da `node_modules` cancellato: OK, 1254 pacchetti in 22s.
- Profilo memoria lint (picco RSS reale, non stimato):
  | scope | picco | tempo |
  |---|---|---|
  | `.` (intero repo) | 2129 MB → 1134 MB dopo cleanup | 46s → 51s |
  | `src` | 1159 MB | 34s |
  | `supabase/functions` | 1016 MB | 10s |
  | `scripts` | 547 MB | 2s |
  Conclusione: nessun OOM con heap di default; **nessun `NODE_OPTIONS=8GB`**
  introdotto. I lotti separati non sono necessari, restano un'opzione se il
  picco supera ~3 GB.
- `npm run verify` = typecheck + lint:ratchet + debt:check + audit:function-auth
  + vitest + build. Non nasconde warning (il ratchet li stampa per regola).

## B — Governance
- Regole custom `tmwe/no-direct-ai-invoke` (36) e `tmwe/no-direct-bulk-op` (9)
  agganciate in report-only con ratchet; nessun disable globale.
- Copertura lint estesa a `supabase/functions` (globals Deno) e `scripts`.
- Confine UI→DAL esteso a `src/v2/ui` (507 findings `no-restricted-imports`,
  a budget, nessuna correzione di massa).
- **32 dichiarazioni lazy non referenziate in `src/v2/routes.tsx`**: non sono
  codice morto. 22 sono montate via `src/v2/config/labTabs.ts` (lazy nel Lab
  hub), le altre via `sections/*Section.tsx` (import diretto) o
  `src/lib/prefetchRoutes.ts`. Sono **dichiarazioni duplicate**, le pagine sono
  vive. **Nessuna cancellazione.**

## C — Pulizia warning (primo lotto)
- Rimossi solo import provatamente inutilizzati (regola singola, via API ESLint
  con filtro fix per `unused-imports/no-unused-imports`): 38 file, nessun file
  di routing toccato.
- CSS malformato risolto all'origine: la classe di caratteri regex in
  `src/v2/services/sherlock/markdownPrettify.ts` veniva raccolta dallo scanner
  Tailwind come arbitrary property. Sostituita con alternanza equivalente.
  Warning esbuild `css-syntax-error` **eliminato**.

## Prima / dopo
| Metrica | Prima | Dopo |
|---|---|---|
| ESLint errori | 0 | 0 |
| ESLint warning | 1283 | 1189 |
| `unused-imports/no-unused-imports` | 94 | 0 |
| Warning build CSS | 1 | 0 |
| Typecheck | OK | OK |
| Vitest | 394 file / 3147 pass / 2 skip | idem |
| `npm ci` da zero | OK | OK |
| untypedFrom / asNever / asUnknownAs / explicitAny (src) | 0 / 22 / 88 / 6 | invariato |

Gate esterni non eseguibili offline (blocco atteso): DB usa-e-getta e E2E
autenticati. Migrazioni correttive: **non applicate**, restano pending.
