## Problema

Errore lato client: `Edge function "ai-assistant" failed: Failed to send a request to the Edge Function`.

## Diagnosi

Dai log:

1. **Auth logs** mostrano un loop di `403 bad_jwt — token contains an invalid number of segments` su `/auth/v1/user` ogni ~16 secondi, dallo stesso browser, negli stessi minuti dell'errore (03:00:05 → 03:00:51).
2. **ai-assistant logs**: la function ha risposto **200** alle 02:57 e 02:58, poi **shutdown** ripetuti tra 03:00:50 e 03:01:27 — segno che il client smette di chiamarla bene perché la sessione è marcata invalida prima ancora di partire la fetch.
3. Il messaggio "Failed to send a request to the Edge Function" è il testo standard che `supabase-js` produce quando la fetch crasha lato client (JWT malformato negli headers, non risposta HTTP).
4. Nel codice ci sono **20+ chiamate a `supabase.auth.getUser()`** sparse in hook e componenti. Questo viola la regola in memoria *"NO `getUser()` di rete per validare JWT"*. Ogni `getUser()` con un token corrotto genera un 403 e contribuisce a marcare la sessione invalida.

**Causa primaria**: il JWT in `localStorage` è corrotto (probabilmente troncato da un refresh fallito o da un vecchio formato). Tutte le chiamate autenticate — incluso `ai-assistant` — falliscono.

**Causa contribuente**: le `getUser()` di rete amplificano il problema invece di leggere la sessione localmente.

## Cosa farò

### 1. Recovery automatico della sessione corrotta (priorità 1)

In `AuthProvider`, aggiungere un guard all'avvio: se `getSession()` ritorna una sessione il cui `access_token` non rispetta il formato JWT (3 segmenti separati da `.`) o il cui `expires_at` è scaduto, eseguire `supabase.auth.signOut({ scope: 'local' })` e ripulire `localStorage` per evitare il loop di 403. L'utente verrà rimandato al login con messaggio chiaro.

### 2. Migliorare il messaggio d'errore in `invokeEdgeV2`

In `src/v2/io/edge/client.ts`, distinguere:
- `Failed to send a request` / network error → messaggio "Sessione scaduta, effettua di nuovo il login" + trigger di logout automatico
- 401/403 dalla function → stesso flusso
- 5xx → "Errore temporaneo del motore AI, riprova"
- altro → messaggio attuale

In questo modo l'utente non vede più il messaggio criptico ma viene guidato.

### 3. Sostituire le `getUser()` di rete con `getSession()` (cleanup conforme a memoria)

Convertire le ~20 occorrenze trovate (in `useWorkspacePresets`, `MemoryDashboard`, `FeedbackButtons`, `GlobalVoiceFAB`, `useWhatsAppDomLearning`, `telemetry`, `useAppSettings`, `TokenSettingsPanel`, `rbac.ts`, ecc.) da:
```ts
const { data: { user } } = await supabase.auth.getUser();
```
a:
```ts
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user ?? null;
```
`getSession()` legge dal local storage senza chiamata di rete e rispetta la regola di memoria *"NO `getUser()` di rete per validare JWT"*.

### 4. Verifica edge function

Controllare brevemente che `ai-assistant/index.ts` non abbia regressioni introdotte nelle ultime modifiche e che gestisca correttamente i mode `tool-decision`, `plan-execution`, `standard` (quelli usati da CommandPage). I test di integrazione esistenti (`index.integration.test.ts`) verranno eseguiti per conferma.

### 5. Test post-fix

- Pulire la sessione (logout+login) e verificare che CommandPage risponda.
- Verificare che il loop di 403 su `/auth/v1/user` sparisca dai log.
- Verificare che, simulando un token corrotto, l'app effettui logout pulito invece di andare in loop.

## File principali toccati

- `src/v2/AuthProvider.tsx` (guard JWT corrotto)
- `src/v2/io/edge/client.ts` (error handling)
- ~12 file con `getUser()` da convertire a `getSession()`
- nessuna modifica a `supabase/functions/ai-assistant/*` (la function è sana)

## Cosa NON farò

- Non toccherò `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria).
- Non aggiungerò Google OAuth né cambierò il flusso whitelist.
- Non modificherò la logica di prompt/audit appena introdotta in CommandPage.
