# AUDIT FINALE — Campagna qualità TMWE Navigator (2026-07-31)

Metodologia identica a baseline 74.720 e checkpoint 88.200 (contatore multilinea
su `src/**` con allowlist DAL minima; gate = typecheck + lint + guard + 2 suite
Vitest consecutive + build).

## BATCH 10 — E2E (nessun deploy, nessuna mutazione produttiva)

- Ambiente: app locale (dev server 8080). Browser Node Playwright assente
  (`chromium-1223`), eseguito con il Chromium 1194 disponibile in sandbox.
- **E2E autenticati: BLOCCATI.** `LOVABLE_BROWSER_AUTH_STATUS=signed_out`: nessuna
  sessione valida disponibile e per vincolo non si richiedono/registrano credenziali.
  28 spec su 80 usano `fixtures/auth` e non sono eseguibili (es. `csp-header-presence`).
- Suite pubblica eseguita (52 spec, 13,7 min): **257 passed, 194 failed, 1 skipped**.
- Cause reali dei fallimenti (nessuna regressione della campagna):
  1. mancanza di sessione: le spec che navigano rotte protette si aspettano il
     contenuto renderizzato ma ottengono il redirect a `/auth`
     (`all-routes-deep-invariants` 32, `token-cockpit` 26, `calendar-flow` 20, ecc.);
  2. spec disallineate all'attuale `LoginPage` popup-based: cercano
     `input[type=email]`, la pagina mostra "Preparazione login…" con 0 input;
  3. `home.smoke`: unico `console.error` = warning Chromium
     "CSP directive 'frame-ancestors' is ignored when delivered via <meta>"
     (preesistente, da `index.html`).
- Coperti e verdi: caricamento root, titolo/document, error boundary assente,
  redirect auth per `/`, `/partners`, `/agents`, `/email`, `/campaigns`,
  `/settings`, `/v1/*`, routing e render mobile su decine di rotte.

## BATCH 11 — Metriche finali (misurate, non stimate)

| Metrica                                                  | Baseline                                       | Ora                                                    |
| -------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Bypass DAL (`supabase.from/rpc/storage` fuori allowlist) | 733 → 427                                      | **0** (ratchet a 0)                                    |
| `as never`                                               | 215                                            | 164                                                    |
| `as unknown as`                                          | —                                              | 317                                                    |
| `: any`                                                  | —                                              | 393                                                    |
| `untypedFrom(`                                           | —                                              | 191                                                    |
| `@ts-ignore/@ts-nocheck/@ts-expect-error`                | —                                              | **0**                                                  |
| `eslint-disable` in src                                  | —                                              | **0**                                                  |
| Test Vitest                                              | 3107                                           | **3114 pass, 2 skip, 390 file** (2 run consecutive)    |
| ESLint                                                   | 1339 errori                                    | **0 errori**, 375 warning                              |
| Typecheck                                                | —                                              | **verde**                                              |
| Build                                                    | —                                              | **verde** (51,6 s; entry 934 KB / 276 KB gz)           |
| Edge contracts                                           | 12 shape errore                                | contratto canonico `{error,code,details,extra}` + test |
| DB drift                                                 | —                                              | 0 su 216 tabelle / 14 view (read-only)                 |
| Complessità hotspot                                      | `contextInjection` 483, `toolHandlersRead` 526 | 140 / 23 (moduli estratti)                             |

Nessun bypass spostato: i file toccati nei batch 6-9 non contengono `as never`,
`as unknown as`, ts-ignore o eslint-disable (verificato con rg sul diff).

## Voto per area (/100000 pesato)

- Architettura dati (DAL 0): 97.000
- Type safety residua (`as unknown as` 317, `any` 393, `untypedFrom` 191): 78.000
- Edge functions & contratti: 89.000
- KB/memoria e agenti/automazioni: 88.000
- DB/drift/RLS: 92.000
- Complessità e dimensione: 82.000 (`agent-execute` ancora ~2,7k LOC)
- Bundle/prestazioni: 80.000 (entry 934 KB, exceljs/xlsx lazy, barrel lucide in Atlas)
- Test unit/integr.: 90.000
- **E2E: 45.000** (autenticati non eseguibili, 194 fail ambientali)

**Voto finale: 84.900 / 100.000.** Non dichiaro 90.000: la copertura E2E reale e
i cast residui non lo sostengono.

## Lavoro residuo

1. Sessione E2E dedicata (utente di test) o mock auth locale → sblocca 28 spec.
2. Allineare le spec login all'attuale flusso popup.
3. Ridurre `as unknown as` / `untypedFrom` con tipi generati.
4. Split `agent-execute`; code-splitting entry 934 KB e barrel `lucide-react`.
