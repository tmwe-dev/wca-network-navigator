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