## Esecuzione correttiva 2026-07-31 (aggiornamento)

Comando riproducibile in sandbox:

```bash
E2E_CHROMIUM_PATH=/nix/store/<chromium>/bin/chromium npx playwright test --reporter=list
```

Risultato suite completa: **317 passed / 156 failed / 123 skipped** (era 257/194).

Correzioni applicate:

- `index.html` + `src/lib/csp.ts`: nuovo `CSP_META_CONTENT` senza `frame-ancestors`
  (direttiva ignorata nel `<meta>`, generava console error). L'header HTTP resta completo.
- `LoginPage.tsx`: separati `callbackError` (da `?tmwe=error&reason=`) e `startError`,
  così il motivo di rifiuto non veniva più cancellato dal refresh dell'URL OAuth.
- `auth-guard.spec.ts`, `app-routing-access.spec.ts`, `smoke/01-auth-flow.spec.ts`:
  allineate al flusso TMWE-only (nessun input email/password).

Classificazione dei 156 fallimenti residui: **tutti su rotte protette** che richiedono
una sessione TMWE reale (token-cockpit 31, calendar 20, deals 14, email-composer 9, …).
Non sono difetti applicativi ma indisponibilità di credenziali E2E: sbloccabili solo
iniettando `E2E_SUPABASE_SESSION_JSON` (harness già pronto in `e2e/fixtures/auth.ts`).

Nota: i warning React `forwardRef` osservati in precedenza provengono dal tagger del
dev server Vite e non compaiono sulla build preview usata dalla CI.

# E2E autenticati — stato BLOCKED (2026-07-31)

## Causa verificabile

L'app accetta un'unica porta d'ingresso: **TMWE OAuth** (`mem://auth/tmwe-only-auth-2026-05-05`).
`/v2/login` non espone più form email/password, signup o reset: la vecchia
fixture E2E che compilava `input[type="email"]` puntava a UI inesistente.

Non esiste modo di autenticare Playwright senza:

- credenziali TMWE reali (vietate dal mandato: nessuna credenziale richiesta o registrata), oppure
- una sessione Supabase già emessa e passata all'harness.

In sandbox `LOVABLE_BROWSER_AUTH_STATUS=signed_out` → nessuna sessione disponibile.

## Harness previsto (solo test/local)

`e2e/fixtures/auth.ts` riusa una sessione esistente **se e solo se** sono presenti:

```
E2E_SUPABASE_SESSION_JSON   # oppure LOVABLE_BROWSER_SUPABASE_SESSION_JSON
E2E_SUPABASE_STORAGE_KEY    # oppure LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
```

Proprietà di sicurezza:

- nessun segreto versionato, nessun valore di default;
- nessun codice applicativo modificato: non esiste bypass runtime attivabile in produzione;
- se le variabili mancano le spec sono marcate skip **con causa esplicita**
  (`AUTH_BLOCKED_REASON`), non skip generico.

## Perimetro bloccato

Tutte le spec che importano `e2e/fixtures/auth` (28 file) restano BLOCKED
finché non viene fornita una sessione. Le spec pubbliche (routing, auth guard,
error boundary, invarianti di sicurezza) girano e devono restare verdi.

## Sblocco

Eseguire il login TMWE nella preview Lovable e rilanciare la suite: la sessione
viene iniettata dall'ambiente e le spec passano automaticamente da BLOCKED a run.
