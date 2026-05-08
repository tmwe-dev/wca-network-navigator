
# Bridge senza content script + diagnostica invio LinkedIn

Due interventi separati. Si possono shippare insieme o uno per volta.

## Parte A — Bridge via `externally_connectable` (rimuove la barra Chrome)

### Perché
Oggi LinkedIn e WhatsApp espongono un `content_script` su `*.lovable.app/*` (e localhost/lovableproject). Quel content script è il bridge: il pannello fa `window.postMessage`, content.js lo intercetta e lo gira a background via `chrome.runtime.sendMessage`. Questa "attività dell'estensione sulla pagina" fa apparire la barra Chrome in cima.

`externally_connectable` permette alla pagina dell'app di chiamare **direttamente** `chrome.runtime.sendMessage(EXT_ID, msg)` senza che venga iniettato nulla nella pagina. Niente content script su lovable.app → niente barra.

### Cosa cambia in dettaglio

1) **Manifest LinkedIn** (`public/linkedin-extension/manifest.json`):
   - Rimuovere completamente `content_scripts` (resta vuoto).
   - Aggiungere `"externally_connectable": { "matches": ["https://*.lovable.app/*", "https://*.lovableproject.com/*", "http://localhost/*", "http://127.0.0.1/*"] }`.
   - Aggiungere `"key": "<chiave pubblica RSA stabile>"` per fissare l'Extension ID (altrimenti l'ID cambia a ogni installazione e l'app non sa chi chiamare).
   - Bump → `3.10.0`.

2) **Manifest WhatsApp** (`public/whatsapp-extension/manifest.json`): stesso trattamento, bump → `5.11.0`.

3) **Background LinkedIn** (`background.js`):
   - Aggiungere handler `chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {...})` che riceve i messaggi dall'app.
   - Lo stesso handler riusa la pipeline esistente: validazione payload (whitelist `ALLOWED_ACTIONS`), validazione origine `sender.origin`, dispatch alle azioni (Actions.*, HybridOps.*).
   - Riposta via `sendResponse(...)` (return `true` per async).
   - Rimuovere il relay verso `content.js` (non più necessario per l'app; resta solo per le tab linkedin.com se serve).

4) **Background WhatsApp**: stesso pattern.

5) **content.js LinkedIn/WhatsApp**: NON eliminati. Restano per le tab `linkedin.com` / `web.whatsapp.com` perché lì sono il "braccio" che esegue `executeScript` / parsing DOM. Solo il match `*.lovable.app/*` viene rimosso dal manifest. Niente quindi sull'app.

6) **App lato client** — file `src/components/test-extensions/extensionBridge.ts` e tutti i punti che usano `waMsg/liMsg`:
   - Esporre due costanti `LI_EXT_ID` e `WA_EXT_ID` (gli ID derivati dalla `key` del manifest).
   - Nuovo helper `chromeMsg(extId, action, payload, timeout)` che fa `chrome.runtime.sendMessage(extId, {action, ...payload})` con `Promise` + timeout.
   - `waMsg`/`liMsg` provano **prima** `chromeMsg` (nuovo bridge); se l'estensione non è installata o il browser non espone `chrome.runtime`, **fallback** al vecchio `postMessage` (così le installazioni vecchie continuano a funzionare durante la transizione).
   - `ensureLiConfig` viene chiamato sul nuovo canale (manda `setConfig` come prima).

7) **Hook esistenti** che usano direttamente `window.postMessage` (`useLinkedInExtensionBridge`, `useLinkedInMessagingBridge`, equivalenti WA): inseriamo lo stesso fallback nel layer di trasporto, niente cambi a chiamanti.

8) **Generazione `key` + Extension ID stabili**:
   - Generiamo una coppia di chiavi RSA dedicata (una per LI, una per WA) lato dev.
   - Inseriamo la pubblica in `manifest.json` come `"key": "..."`.
   - L'Extension ID risultante (deterministico) viene messo in `src/lib/extensionIds.ts` (importato dall'app).
   - Documentazione in `public/linkedin-extension/README-bridge.md`.

9) **Bump catalog + zip + `whatsappExtensionZip.ts`** (LI 3.10.0, WA 5.11.0). Ricrea zip versionati e overrides `linkedin-extension.zip` / `whatsapp-extension.zip` legacy.

### Effetti collaterali da gestire
- Il pannello Test richiede ora che l'estensione **aggiornata** sia installata. Se è installata la vecchia (con content_script), il bridge funziona ancora via fallback postMessage (e quindi mostra ancora la barra finché l'utente non aggiorna). Mostriamo nel terminal un messaggio chiaro quando si entra in fallback: `⚠️ Bridge legacy via postMessage (estensione vecchia). Aggiorna a v3.10.0+ per rimuovere la barra Chrome.`
- L'origin check passa da `event.origin` (postMessage) a `sender.origin` (runtime). Stessa whitelist.
- Optimus relay (eventi async dal background → app): oggi viaggia via `chrome.runtime.sendMessage` → content.js → `window.postMessage`. Con externally_connectable possiamo aprire un `chrome.runtime.connect(extId)` long-lived dall'app e inviare eventi sul `Port`. Implementato come secondo helper `subscribeExtensionEvents(extId, onEvent)`. Il listener `subscribeOptimusEvents` (oggi basato su `window.addEventListener('message')`) viene esteso per ascoltare anche dal `Port`.

### Fuori scopo
- Non si tocca FireScrape (resta col bridge attuale finché non chiediamo).
- Non si tocca la logica DOM/AX su LinkedIn/WhatsApp.
- Non si tocca `check-inbox`, `email-imap-proxy`, `mark-imap-seen`.

## Parte B — Diagnostica invio LinkedIn (3.9.16, no fix logica)

### Cosa aggiungiamo

1) **Stampa versione PRIMA di ogni invio** in `src/components/test-extensions/LinkedInTest.tsx`: il `testSendMessage` prima del `📤 Invio messaggio LinkedIn...` fa `liMsg("ping")` e logga `🔧 Estensione installata: vX.Y.Z (richiesta: 3.9.16)`. Se mismatch, `error` con istruzioni "rimuovi e ricarica".

2) **Probe DOM dentro `sendMessage`** (`public/linkedin-extension/hybrid-ops.js`): quando il fallback strutturale non trova il textbox, prima del return `success:false` esegue uno `chrome.scripting.executeScript` di **soli reads** che raccoglie:
   - `document.location.href`
   - `document.querySelectorAll("[contenteditable='true']").length`
   - `document.querySelectorAll("[role='textbox']").length`
   - presenza overlay `document.querySelectorAll(".msg-overlay-conversation-bubble").length`
   - presenza dialog aperti `document.querySelectorAll("[role='dialog']").length`
   - testo del primo `[role='dialog']` (max 200 char) per capire se è il dialog di "Premium upgrade" o altro
   - elenco dei primi 5 button visibili nel dialog (textContent)
   
   E lo allega in `error` come stringa JSON. Niente nuove permission.

3) **Stampa probe nel terminal**: `LinkedInTest` quando riceve `error` se contiene `__probe__` lo logga formattato (4-5 righe leggibili) così vediamo a colpo d'occhio cosa è successo.

4) **Bump → 3.9.16** (manifest, catalog, costante `LINKEDIN_EXTENSION_REQUIRED_VERSION`, zip legacy + versionato).

Nessun cambio alla logica di click/findBox: prima i log, poi (in un giro successivo) decidiamo l'eventuale correzione mirata in base ai dati raccolti.

## File toccati

**Parte A:**
- `public/linkedin-extension/manifest.json`, `public/linkedin-extension/background.js`, `public/whatsapp-extension/manifest.json`, `public/whatsapp-extension/background.js`
- `src/components/test-extensions/extensionBridge.ts`
- `src/lib/extensionIds.ts` (nuovo)
- `src/lib/whatsappExtensionZip.ts` (bump versioni)
- `public/chrome-extensions/catalog.json`
- nuovi zip versionati + override legacy
- `public/linkedin-extension/README-bridge.md` (nuovo)

**Parte B:**
- `src/components/test-extensions/LinkedInTest.tsx`
- `public/linkedin-extension/hybrid-ops.js`
- manifest LI 3.9.16 → 3.10.0 (Parte A include già il bump più alto)
- catalog + zip

## Ordine consigliato
1. **Parte B** prima (cambio piccolo, ti dà subito dati per capire perché `no textbox found`).
2. **Parte A** dopo (refactor più grande che merita una PR a sé).

Posso shippare solo B, solo A, o entrambe in sequenza nello stesso turno. Parte A include anche la rimozione della barra dall'estensione WhatsApp.
