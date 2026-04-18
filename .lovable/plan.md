
## Diagnosi certa

Sì: il problema l’ho introdotto io nella nuova architettura.

### Root cause WhatsApp
In `public/whatsapp-extension/actions.js`, `readUnreadMessages()` chiama:
- `TabManager.activateAndStabilize(r.tab.id, 3000)`

E in `public/whatsapp-extension/tab-manager.js`, `activateAndStabilize()` fa:
- `chrome.tabs.update(tabId, { active: true })`

Quindi la lettura unread porta davvero il tab WhatsApp in primo piano.

In più, `getOrCreateWaTab()` crea il tab nel window corrente (`chrome.tabs.create(...)` senza `windowId`) e `getBestExistingWaTab()` privilegia addirittura i tab attivi. Quindi oggi la strategia è intrusiva per design.

### Root cause LinkedIn
Sì, anche LinkedIn è rotto nello stesso modo.

In `public/linkedin-extension/actions.js`:
- `readInbox()` chiama `ensureTabVisibleAndWait(tab.id, 1200)`
- `readThread()` chiama `ensureTabVisibleAndWait(tab.id, 1200)`
- anche `extractProfileByUrl`, `sendLinkedInMessage`, `sendConnectionRequest`, `searchProfile` lo fanno

E in `public/linkedin-extension/tab-manager.js`, `ensureTabVisibleAndWait()` fa:
- `chrome.tabs.update(tabId, { active: true })`

Inoltre `getLinkedInTab()` può riusare tab LinkedIn già esistenti dell’utente e navigarli.

## Errore architetturale

La scelta “DOM stabile = attivo nella finestra utente” è sbagliata per questo prodotto.  
Qui il vincolo corretto è:

- mai rubare il focus del Cockpit
- mai cambiare tab nella finestra su cui l’utente sta lavorando
- mai riusare tab utente per automazioni WA/LI

## Piano di correzione

### 1) Isolare WA e LI in tab gestiti dall’estensione
Modificherò:
- `public/whatsapp-extension/tab-manager.js`
- `public/linkedin-extension/tab-manager.js`

Per fare in modo che:
- WA e LI usino solo tab “owned” dall’estensione
- i tab nuovi non vengano più creati nella finestra del Cockpit
- non vengano più riusati tab utente già aperti

Approccio:
- creare/riusare una finestra dedicata di automazione non focalizzata
- aprire lì i tab WA/LI
- salvare `windowId/tabId` gestiti dall’estensione
- se esiste un tab WA/LI nella finestra utente, ignorarlo

### 2) Rimuovere il focus stealing dai flussi di lettura
Modificherò:
- `public/whatsapp-extension/actions.js`
- `public/linkedin-extension/actions.js`

Per fare in modo che:
- `readUnreadMessages()`
- `readInbox()`
- `readThread()`

non usino più tab che possano impattare la vista utente.

### 3) Riscrivere stabilize/visibility in modalità non intrusiva
Modificherò:
- `activateAndStabilize()` WA
- `activateAndStabilize()` LI
- `ensureTabVisibleAndWait()` LI
- shim WA backward-compat

Nuova regola:
- è consentito attivare un tab solo dentro la finestra di automazione dell’estensione
- mai attivare un tab nella finestra attualmente focalizzata dall’utente
- se il tab è nella finestra sbagliata, va ricreato/spostato nell’area di automazione

### 4) Correggere le euristiche di reuse
Modificherò:
- `getBestExistingWaTab()`
- `getOrCreateWaTab()`
- `getLinkedInTab()`
- eventuali helper di sorting/reuse

Per evitare:
- preferenza per tab attivi
- reuse cieco di qualunque tab `web.whatsapp.com` / `linkedin.com`
- navigazione di tab utente già aperti

### 5) Verifica specifica LinkedIn
Controllerò e sistemerò tutti i path LI che oggi possono spostare la vista:
- `readInbox`
- `readThread`
- `extractProfileByUrl`
- `sendLinkedInMessage`
- `sendConnectionRequest`
- `searchProfile`
- eventuale `diagnostic()`

## Risultato atteso

Dopo la fix:
- leggere i messaggi WhatsApp non deve più cambiare pagina nel Cockpit
- leggere inbox/thread LinkedIn non deve più cambiare pagina
- i tab WA/LI usati dall’estensione devono vivere fuori dal flusso visivo dell’utente
- l’estrazione deve continuare a funzionare senza riusare tab utente

## File da toccare

- `public/whatsapp-extension/tab-manager.js`
- `public/whatsapp-extension/actions.js`
- `public/linkedin-extension/tab-manager.js`
- `public/linkedin-extension/actions.js`

Possibile aggiornamento anche di:
- `public/whatsapp-extension/background.js`
- `public/linkedin-extension/background.js`

solo se serve persistere metadata dei tab/finestra gestiti.

## Verifiche che farò dopo l’implementazione

1. Nessun `chrome.tabs.update({ active: true })` deve più colpire tab nella finestra utente.
2. Nessun reuse di tab utente WA/LI.
3. WA `readUnreadMessages()` deve funzionare senza spostare la vista.
4. LI `readInbox()` e `readThread()` devono funzionare senza spostare la vista.
5. Verifica end-to-end sul caso reale: Cockpit aperto, lettura WA/LI, vista invariata.

## Nota importante

Non è un bug “forse”: è confermato dal codice attuale.  
WhatsApp è rotto. LinkedIn è potenzialmente rotto nello stesso modo.  
La correzione giusta non è un altro cerotto: è separare definitivamente i tab di automazione dai tab dell’utente.
