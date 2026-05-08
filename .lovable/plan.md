
# Fix invio LinkedIn — il messaggio finisce nella conversazione sbagliata

## Diagnosi confermata

L'audit (`.lovable/plan.md` §2 P1 punto 8) aveva segnalato il problema attorno a `findBox`/`nativeInsertText`. Rivedendo il codice ora il difetto vero è in **`clickMessage`** (`public/linkedin-extension/hybrid-ops.js` riga 340-358), non in `sendMessage`.

### Catena del bug

1. `Actions.sendLinkedInMessage(profileUrl, message)` naviga correttamente la tab al profilo (`getLinkedInTab` → `chrome.tabs.update` + `waitForLoad`). ✓
2. Poi chiama `HybridOps.clickMessage(tabId)`. Il fallback strutturale è:
   ```js
   document.querySelectorAll("button, a").find(el =>
     /^messag|^scrivi/i.test(el.textContent.trim()) && el.offsetParent !== null
   )
   ```
3. La regex `^messag` matcha tre cose, in ordine di apparizione nel DOM:
   - **"Messaggi"** (link top-nav globale, alto nel DOM) → click → tab naviga a `/messaging/`.
   - **"Messaggistica"** (variante locale top-nav).
   - **"Messaggia"** / "Message" (bottone scoped al profilo, più in basso).
   
   Il primo vince → finisce nell'inbox.
4. Una volta in `/messaging/`, `sendMessage` trova il textbox della prima conversazione aperta e scrive lì. Messaggio inviato al contatto sbagliato.
5. Lato app vediamo `success: true` perché tecnicamente il send è avvenuto — la funzione non ha modo di sapere che ha colpito un'altra persona.

In più: nelle UI LinkedIn più recenti il bottone "Messaggia" del profilo è **dentro il menu "Altro/More"**. `sendMessage.findMoreBtn` lo apre correttamente, ma `clickMessage` non lo prova e quindi cade sempre nel match della top-nav.

### Cosa NON è il bug

- **TabManager**: `chrome.tabs.query({ url: "*://*.linkedin.com/*" })` filtra per dominio LinkedIn, quindi è impossibile colpire la tab dell'app web. La navigazione al profilo avviene davvero.
- **content.js / origin restriction**: ok, indipendente.
- **`nativeInsertText`**: ok, opera dentro la tab linkedin.com.
- **Lettura inbox/extractProfile**: già funzionano perché non dipendono da `clickMessage`.

## Fix mirato (cambio piccolo, locale, reversibile)

### 1) `clickMessage` — scope a `main`, esclusione nav, match esatto, supporto "Altro/More"

In `public/linkedin-extension/hybrid-ops.js` sostituire il fallback strutturale di `clickMessage` con la stessa logica già usata in `sendMessage.findMessageBtn` + `findMoreBtn`:

- Cercare SOLO dentro `document.querySelector("main")` (esclude top-nav globale).
- Per ogni candidato, escludere se è dentro un `nav`, `header[role='banner']`, `[data-test-global-nav]` o il selettore `.global-nav`.
- Match testuale **esatto** (`^(messaggia|message)$` per `textContent`; allargare con `aria-label` `^(messaggia|message)$`).
- Se non trovato, aprire il menu "Altro/More" (regex già esistente in `findMoreBtn`), aspettare 800ms, ricercare il bottone "Messaggia" come voce `[role='menuitem']`.
- Se ancora non trovato → ritornare `success:false` con error chiaro `"Profile-scoped message button not found"`.

### 2) `sendMessage` — guardia URL pre-invio

Prima del polling `findBox`, verificare che la tab sia ancora su una pagina profilo `/in/<slug>` (no `/messaging/`, no `/feed/`). Se non lo è → ritornare `success:false` con `"navigation_drifted"`. Questo blocca casi residui dove qualcosa naviga via durante il flow.

In `Actions.sendLinkedInMessage`, se la guardia scatta, ri-navigare al `profileUrl` e rifare un solo retry di `clickMessage` + `sendMessage`. Se anche questo fallisce, errore esplicito.

### 3) Bump versione estensione → 3.9.15

- `public/linkedin-extension/manifest.json` → `version: "3.9.15"`, description: "Fix invio LinkedIn: il bottone Messaggia ora è scoped al profilo, niente più match con la top-nav inbox".
- `src/lib/whatsappExtensionZip.ts` → `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.15"`.
- `public/chrome-extensions/catalog.json` → aggiungere voce 3.9.15 `current: true`, marcare 3.9.14 `current: false`.
- Rebuild `.zip` (sia `linkedin-extension-3.9.15.zip` sia `linkedin-extension.zip` legacy).

### 4) Niente altro

- Non tocco `getLinkedInTab`, non tocco `nativeInsertText`, non tocco gli hook lato app.
- Nessun cambio al flusso di lettura inbox (già funzionante).
- Nessun cambio agli hard limits, RLS, CORS, edge functions.

## Test atteso dopo il fix

1. Reinstallare estensione 3.9.15.
2. Aprire `LinkedIn Test`, incollare URL profilo `https://www.linkedin.com/in/gianfranco-cristiano-12513434/`.
3. Inviare messaggio test.
4. Verifica visiva: la tab LinkedIn (anche se inattiva) deve restare sull'URL `/in/gianfranco-cristiano-12513434/` e aprire il dialog di messaggio in basso a destra (overlay del profilo), NON andare in `/messaging/`.
5. Il messaggio appare nella conversazione del profilo target (ricontrollare aprendo l'inbox manualmente).

## File toccati

- `public/linkedin-extension/hybrid-ops.js` — fix `clickMessage` + guardia URL in `sendMessage`.
- `public/linkedin-extension/manifest.json` — bump 3.9.15.
- `public/linkedin-extension/` → rebuild zip.
- `public/chrome-extensions/catalog.json` — aggiungi 3.9.15.
- `public/chrome-extensions/linkedin/linkedin-extension-3.9.15.zip` — nuovo.
- `public/linkedin-extension.zip` — rebuild legacy.
- `src/lib/whatsappExtensionZip.ts` — `LINKEDIN_EXTENSION_REQUIRED_VERSION`.

Nessuna modifica a edge functions, DB, RLS, hook React, UI, journalistReview.
