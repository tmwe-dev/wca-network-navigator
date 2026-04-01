
# Fix vero del flusso LinkedIn: stop bug, stop falsi “connesso”, stop raffiche inutili

Ho controllato il codice e il problema è reale. La parte peggiore è questa: il sistema confonde “l’estensione risponde” con “sei davvero loggato su LinkedIn”.

## Cosa ho trovato

1. `public/linkedin-extension/background.js`
   - `verifySession` fa il check vero, ma poi nel message handler risponde così:
   - `success: true, authenticated: result.authenticated`
   - quindi `success` oggi significa solo “il worker ha risposto”, non “sessione valida”.

2. `src/components/layout/ConnectionStatusBar.tsx`
   - usa `liOk = r.success`
   - quindi la barra alta può diventare verde anche con `authenticated: false`
   - in più parte da sola all’avvio (`activateAll` automatico), quindi tocca LinkedIn anche quando non dovresti.

3. `src/hooks/useAutoConnect.ts`
   - segna LinkedIn “ok” se trova:
     - estensione disponibile
     - oppure credenziali nel DB
     - oppure `linkedin_li_at` salvato nel DB
   - ma il cookie vero che conta è quello del browser Chrome, non quello copiato nel database.
   - quindi salva stati falsi.

4. `src/components/settings/ConnectionsSettings.tsx`
   - usa `liConnected = liExt.isAvailable || liHasCreds`
   - cioè basta avere credenziali salvate per mostrarti “Configurato/Connesso”, anche se localmente non sei autenticato.

5. `src/pages/TestLinkedInSearch.tsx` + `src/hooks/useSmartLinkedInSearch.ts`
   - il test non fa un preflight auth serio.
   - parte direttamente con 5 contatti × fino a 4 query.
   - quindi scatena una raffica di `searchProfile`.
   - non è AI che impazzisce: oggi è un loop deterministico di query hardcoded.
   - se la sessione non è valida, LinkedIn redirige alla login/challenge e tu vedi autenticazioni “fuori posto”.

6. `src/pages/Cockpit.tsx`, `src/components/cockpit/AIDraftStudio.tsx`, `src/hooks/useLinkedInFlow.ts`
   - search, scrape, DM e connect partono se `liBridge.isAvailable` è true
   - ma quasi mai controllano `authenticated === true` prima di partire.

7. Dai log:
   - raffica di `searchProfile`
   - errori tipo `No tab with id` e `Tabs cannot be edited right now`
   - quindi c’è anche un problema di gestione tab troppo aggressiva.

## Cosa costruisco per sistemarlo

### 1) Separare 3 stati diversi
In tutta la UI LinkedIn va separato così:
- Estensione rilevata
- Credenziali/cookie configurati
- Sessione LinkedIn realmente autenticata

“Connesso” dovrà voler dire solo: sessione locale valida davvero.

### 2) Correggere il contratto del bridge
In `useLinkedInExtensionBridge` aggiungo un helper unico tipo `ensureAuthenticated()` che:
- verifica estensione
- chiama `verifySession()`
- considera valido solo `authenticated === true`
- restituisce errore chiaro se non sei loggato

Tutti i flussi LinkedIn useranno questo helper, non `isAvailable` da solo.

### 3) Smettere di verificare LinkedIn in modo invasivo all’avvio
In `ConnectionStatusBar` e `useAutoConnect` tolgo la logica aggressiva che apre check attivi appena carichi la pagina.
Nuova regola:
- la barra non deve lanciare verifiche intrusive in automatico su ogni route
- la verifica vera si fa:
  - quando clicchi “verifica”
  - oppure appena stai per fare un’azione LinkedIn reale

Così non apriamo login/challenge in posti sbagliati.

### 4) Blocco duro prima di test/search/scrape/send
Metto un preflight unico in:
- `src/pages/TestLinkedInSearch.tsx`
- `src/hooks/useSmartLinkedInSearch.ts`
- `src/pages/Cockpit.tsx`
- `src/components/cockpit/AIDraftStudio.tsx`
- `src/hooks/useLinkedInFlow.ts`

Regola:
- se non sei autenticato davvero, il flusso NON parte
- niente raffica di query
- niente scraping
- niente DM / Connect
- messaggio chiaro: “LinkedIn non autenticato localmente”

### 5) Il test `/test-linkedin` deve fare una sola cosa all’inizio
Prima del batch:
1. controllo sessione reale
2. se ok → parte il test
3. se no → si ferma subito e mostra stato chiaro

Quindi non proverà più 20 ricerche mentre tu sei fuori sessione.

### 6) Harden dell’estensione sui tab
In `public/linkedin-extension/background.js` metto una serializzazione semplice delle operazioni che aprono tab:
- verify
- search
- extract
- send
- connect

Così evitiamo race condition e gli errori “tab id” dovuti al churn.

## File da toccare

- `public/linkedin-extension/background.js`
- `src/hooks/useLinkedInExtensionBridge.ts`
- `src/components/layout/ConnectionStatusBar.tsx`
- `src/hooks/useAutoConnect.ts`
- `src/components/settings/ConnectionsSettings.tsx`
- `src/pages/TestLinkedInSearch.tsx`
- `src/hooks/useSmartLinkedInSearch.ts`
- `src/pages/Cockpit.tsx`
- `src/components/cockpit/AIDraftStudio.tsx`
- `src/hooks/useLinkedInFlow.ts`

## Risultato finale atteso

```text
- La barra alta non mente più
- “Connesso” = sessione LinkedIn vera, non solo estensione viva
- Il test non scatena più raffiche se non sei autenticato
- Cockpit / scrape / DM / connect non partono più alla cieca
- Le credenziali salvate non vengono più confuse con login attivo
- Le chiamate LinkedIn diventano controllate, una alla volta
```

## Nota importante
Il problema principale non è che l’app “chiama autoLogin dappertutto”.
Il vero bug è questo:
- la UI pensa che sei connesso quando non lo sei
- poi i flussi aprono pagine LinkedIn senza preflight
- LinkedIn ti butta sulla login/challenge
- e sembra che il sistema stia chiedendo autenticazione a caso

Quindi prima si ripara l’autenticazione e il gating. Dopo, se vuoi, si rifinisce anche la parte AI della ricerca libera.