## Risultato audit

Hai ragione: la build scaricata dal sistema è determinata dai file statici dell’app, non dal nome che Chrome mostra.

Stato attuale trovato:

- `public/chrome-extensions/catalog.json` punta come corrente a `3.9.56-autoclose`.
- `public/linkedin-extension.zip` è `3.9.56-autoclose`.
- Il pulsante top-bar scarica `/chrome-extensions/linkedin/linkedin-extension-3.9.56.zip`, perché `LINKEDIN_EXTENSION_REQUIRED_VERSION` è rimasto `3.9.56`.
- La pagina catalogo `ExtensionDownloadCatalog` può usare `/linkedin-extension.zip` come fallback per tutte le versioni LinkedIn: oggi quel fallback è `autoclose`.
- Le zip `3.9.56.zip` e `3.9.56-restore.zip` sono identiche nei JS (`actions.js`, `hybrid-ops.js`, `background.js`, `tab-manager.js`, `content.js`) e contengono la build AI-Verified Click.
- `3.9.56-autoclose` differisce davvero in `actions.js` e `hybrid-ops.js`: contiene i 2 sleep ridotti + `closeMessagingComposer`.

Nel database ho trovato solo `extension_dispatch_queue`, senza record LinkedIn recenti. Non c’è una tabella catalogo estensioni: la fonte reale del download è il catalogo statico + zip in `public/`.

## Piano di correzione minimo

1. **Rendere `3.9.56-restore` la build corrente nel catalogo statico**
   - In `public/chrome-extensions/catalog.json`: `latestVersion` → `3.9.56-restore`.
   - `current: true` su `3.9.56-restore`.
   - `current: false` su `3.9.56-autoclose`.

2. **Allineare il fallback principale**
   - Sostituire `public/linkedin-extension.zip` con la zip `linkedin-extension-3.9.56-restore.zip`.
   - Così qualunque download fallback LinkedIn non installerà più autoclose.

3. **Allineare il pulsante top-bar**
   - In `src/lib/whatsappExtensionZip.ts`, portare `LINKEDIN_EXTENSION_REQUIRED_VERSION` a `3.9.56-restore`.
   - Così il pulsante scarica esplicitamente `linkedin-extension-3.9.56-restore.zip`, non `3.9.56.zip` e non `autoclose`.

4. **Non toccare la logica di invio**
   - Nessuna modifica a `hybrid-ops.js`.
   - Nessuna modifica a `actions.js`.
   - Nessuna modifica a `tab-manager.js`, readInbox, writer, CDP, deduplica, WA, Email o backend.

5. **Verifica post-correzione**
   - Controllare manifest dentro `public/linkedin-extension.zip`: `version=3.9.56`, `version_name=3.9.56-restore`.
   - Controllare che `autoclose` non sia più `current`.
   - Controllare che il bottone di download punti a `linkedin-extension-3.9.56-restore.zip`.

## Effetto atteso

Da quel momento “scaricata dal sistema” significherà davvero `3.9.56-restore`, cioè la build AI-Verified Click originale senza auto-close e senza sleep ridotti.