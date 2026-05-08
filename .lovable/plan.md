## Obiettivo
Nella tab "Test LinkedIn" (`/test-extensions`) aggiungere 3 pulsanti di test, uno per ciascun metodo di click sul pulsante "Invia". Così possiamo provarli isolatamente e capire quale funziona meglio nel composer corrente, senza che la cascata di fallback nasconda quale metodo ha vinto.

## I 3 metodi
1. **Click fisico simulato** — `scrollIntoView` + sequenza `pointerdown / mousedown / pointerup / mouseup / click` con coordinate reali sul bottone "Invia". Più affidabile contro listener React/Draft.js.
2. **Form submit** — `requestSubmit()` (con fallback `dispatchEvent(submit)`) sul `<form class="msg-form">` genitore del composer. Bypassa il bottone, attiva l'handler React di submit.
3. **Scorciatoia tastiera** — `Ctrl+Enter` (e fallback `Cmd+Enter` su Mac) sulla textbox. Shortcut nativo LinkedIn.

Ogni metodo, dopo l'azione, verifica per ~1.5s che la textbox si svuoti (come già fa P13). Ritorna `success` solo se la textbox si è davvero svuotata, altrimenti errore esplicito col nome del metodo, così nei log si vede subito chi vince.

## Modifiche

### Estensione (LinkedIn `3.9.25`)
- `public/linkedin-extension/hybrid-ops.js`: aggiungere `sendMessageWithMethod(tabId, message, method)` accanto a `sendMessage`. Riusa la stessa logica di apertura composer + scrittura testo (P3+P5+P13 wake-up), ma il blocco di click usa **solo** il metodo passato (`physical_click` | `form_submit` | `keyboard_shortcut`). Niente cascata. Se la textbox non si svuota → errore con `attempted_method: <nome>`.
- `public/linkedin-extension/actions.js`: aggiungere handler messaggio `sendMessageWithMethod` che instrada al nuovo helper.
- `public/linkedin-extension/manifest.json`: bump `3.9.24` → `3.9.25`.
- `public/chrome-extensions/catalog.json` + `src/lib/whatsappExtensionZip.ts`: bump versione richiesta.
- Rebuild ZIP `public/linkedin-extension.zip` e `public/chrome-extensions/linkedin/linkedin-extension-3.9.25.zip`.

### UI test
- `src/components/test-extensions/LinkedInTest.tsx`: nel pannello "📤 Test Invio Messaggio LinkedIn", sotto al pulsante esistente "Invia LI" (lasciato com'è, è la cascata completa), aggiungere una riga con 3 pulsanti:
  - `🖱️ Click fisico` → chiama `liMsg("sendMessageWithMethod", { url, message, method: "physical_click" })`
  - `📋 Form submit` → metodo `form_submit`
  - `⌨️ Ctrl+Enter` → metodo `keyboard_shortcut`
  Ognuno passa per `runWithCooldown`, logga il metodo usato e mostra `success`/errore distinti, così confrontiamo i risultati nel terminal.

## Cosa NON cambia
- `sendMessage` originale resta intatto (cascata AX → AI Learn → structural+P13). I 3 nuovi pulsanti sono diagnostici, non sostituiscono il flusso produzione.
- Nessuna modifica a guard, cooldown, anti-double-overlay, o pipeline esterne.
- Nessun refactor opportunistico.
