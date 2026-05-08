## Obiettivo

Replicare su LinkedIn la stessa serie di validazioni e robustezza appena verificate su WhatsApp, così che il pannello Test possa essere passato in verde con la stessa fluidità (ping → sessione → cookie → inbox → invio → guard sequence/concorrenza), senza toccare la logica di invio reale né il backfill.

## Scope (cosa cambia, cosa NO)

In scope:
- `src/components/test-extensions/LinkedInTest.tsx` — `testSession` con timeout esteso, retry singolo su timeout e messaggi leggibili (auth required, checkpoint, loading).
- `public/linkedin-extension/auth.js` — `verifySession` ritorna `reason` strutturate (`auth_required`, `checkpoint`, `loading`, `unknown_state`) invece di restituire solo booleano/JSON grezzo.
- Bump versione `manifest.json` LI + ri-zip estensione (`/public/linkedin-extension.zip`) come fatto per Partner Connect.
- Allineamento del flusso `runWithCooldown`/`SyncGuardIndicator`: nessuna modifica al `syncGuard`, solo riuso.

NON in scope:
- Hooks reali di sync/backfill (`useLinkedInSync`, `useLinkedInBackfill`) — non vengono toccati.
- Edge functions, DAL, persistenza messaggi.
- Logica invio messaggi (`sendMessage`).

## Modifiche puntuali

### 1. `auth.js` — `verifySession` strutturato
Oggi ritorna `{ success, authenticated, ... }` con poco contesto. Aggiungiamo:
- `reason: "auth_required"` se la pagina mostra il login form.
- `reason: "checkpoint"` se LI mostra challenge/2FA/security check (selettori `#captcha-internal`, `input[name="pin"]`, URL contiene `/checkpoint/`).
- `reason: "loading"` se la SPA non è ancora montata (no nav, no main).
- `reason: "unknown_state"` come fallback.
- Conserva i campi attuali per non rompere chi già usa la response.

### 2. `LinkedInTest.tsx` — `testSession` resiliente
Stesso pattern adottato per WA:
- timeout 60s invece di 30s,
- 1 retry automatico dopo 3s solo se errore matcha `/timeout/i`,
- log leggibile per `auth_required` ("🔐 Devi loggarti su linkedin.com"), `checkpoint` ("🛡️ LinkedIn richiede verifica/captcha — completa nella tab e riprova"), `loading` ("⏳ LinkedIn ancora in caricamento").
- Comportamento invariato per gli altri pulsanti.

### 3. Versione estensione LI
- `public/linkedin-extension/manifest.json` da `3.9.0` → `3.9.1` (patch coerente con il fix `verifySession`).
- Ri-pacchettizzare `public/linkedin-extension.zip` con `nix run nixpkgs#zip`.
- Nessun cambiamento al required version client se non già strettamente vincolato (verifica in `WHATSAPP_EXTENSION_REQUIRED_VERSION` equivalente per LI: se esiste `LINKEDIN_EXTENSION_REQUIRED_VERSION`, aggiornare; altrimenti lasciare).

## QA

Sequenza da eseguire dopo l'implementazione (manuale, sul pannello Test → tab LinkedIn):
1. 🔌 Ping → versione attesa.
2. 🔑 Sessione → su tab LinkedIn loggata: `authenticated: true`. Su tab non loggata: log "Devi loggarti".
3. 🍪 Sync Cookie → ok.
4. 📨 Leggi Inbox → lista thread.
5. 🛡️ Verifica Controllo → throttle ping/open/read/betweenThreads in sequenza.
6. 🚦 Test Concorrenza → secondo acquire bloccato come previsto.

## Rischi

- Cambiare la shape della response di `verifySession` rompe chi legge solo `authenticated`. Mitigazione: aggiungiamo `reason` ma manteniamo `authenticated` e `success` invariati.
- Bump manifest richiede re-load dell'estensione in Chrome (stessa procedura già nota).

## Out of scope esplicito

Backfill reale dei thread LI e qualunque scrittura su DB restano invariati: si valida solo la catena ping/sessione/lettura/guard come per WA.
