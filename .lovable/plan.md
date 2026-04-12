

# Fix Autenticazione V1 + V2 + Launcher

## Problemi identificati

1. **V1 Auth (`src/pages/Auth.tsx`)**: Dopo il login, fa `navigate("/")` che porta al Launcher invece che a `/v1`. Email/password e Google funzionano tecnicamente, ma il redirect post-login e sbagliato.

2. **V2 LoginPage (`src/v2/ui/pages/LoginPage.tsx`)**: Non ha tab di registrazione. Il Google login in `useAuthV2.ts` usa `supabase.auth.signInWithOAuth` direttamente invece di `lovable.auth.signInWithOAuth` -- questo non funziona perche il progetto usa Lovable Cloud managed OAuth.

3. **V2 useAuthV2**: Il `signInWithGoogle` usa il metodo sbagliato (supabase diretto vs lovable managed).

4. **ConnectionBanner**: Esegue heartbeat ogni 30 secondi anche senza sessione attiva, generando errori 403 nei log ("missing sub claim").

5. **Chunk loading errors**: Errori transitori di import dinamico -- gia gestiti da `ViteChunkRecovery`, non richiedono fix.

## Modifiche

### 1. Fix redirect post-login V1
**File:** `src/pages/Auth.tsx`
- Cambiare `navigate("/", { replace: true })` in `navigate("/v1", { replace: true })` (2 occorrenze: nel `onAuthStateChange` e nel `getSession`)

### 2. Fix V2 Google OAuth
**File:** `src/v2/hooks/useAuthV2.ts`
- Importare `lovable` da `@/integrations/lovable/index`
- Sostituire `supabase.auth.signInWithOAuth({ provider: "google" })` con `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Gestire correttamente `result.redirected` e `result.error`

### 3. Aggiungere registrazione al V2 LoginPage
**File:** `src/v2/ui/pages/LoginPage.tsx`
- Aggiungere tabs Login/Registrati (come nel V1)
- Aggiungere campi nome + email + password per signup
- Aggiungere bottone Google con `signInWithGoogle`
- Aggiungere link "Password dimenticata?"

### 4. Fix ConnectionBanner
**File:** `src/components/system/ConnectionBanner.tsx`
- Controllare se esiste una sessione attiva prima di avviare il heartbeat
- Se non c'e sessione, non fare polling (evita i 403)

### 5. Fix redirect post-login V2
**File:** `src/v2/ui/templates/AuthenticatedLayout.tsx`
- Il redirect a `/v2/login` e corretto, nessuna modifica necessaria
- Verificare che dopo login V2 il redirect vada a `/v2` (gia corretto nel `signInWithGoogle` fix)

## Risultato atteso
- Launcher a `/` senza auth (gia funziona)
- Click "V1" -> `/v1` -> se non autenticato vai a `/auth` -> login -> torna a `/v1`
- Click "V2" -> `/v2` -> se non autenticato vai a `/v2/login` -> login -> torna a `/v2`
- Google OAuth funzionante su entrambe le versioni
- Email/password funzionante su entrambe le versioni
- Whitelist attiva: solo email autorizzate possono accedere

