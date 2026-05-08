Problema trovato dopo 3 giri di audit:

- UI test: invia correttamente `{ url, message, method }` con `method = physical_click | form_submit | keyboard_shortcut`.
- `content.js`: accetta `sendMessageWithMethod` nella whitelist, ma non copia `data.method` nel messaggio inoltrato al background.
- `background.js`: chiama già `Actions.sendLinkedInMessageWithMethod(msg.url, msg.message, msg.method)`.
- `actions.js`: riceve `msg.method` vuoto e risponde correttamente `method mancante`.
- `hybrid-ops.js`: supporta già i tre metodi e li passa allo script LinkedIn.
- ZIP `3.9.25`: contiene lo stesso errore, quindi anche scaricando la 3.9.25 il parametro non passa.

Piano di fix minimo:

1. In `public/linkedin-extension/content.js`, aggiungere solo l’inoltro del campo:
   `if (data.method) msg.method = data.method;`

2. Alzare la release LinkedIn a `3.9.26` per non confonderla con la 3.9.25 già difettosa:
   - `public/linkedin-extension/manifest.json`
   - `public/chrome-extensions/catalog.json`
   - `src/lib/whatsappExtensionZip.ts`
   - pagina/pannello Settings già collegati alla costante.

3. Ricostruire entrambi gli ZIP:
   - `public/chrome-extensions/linkedin/linkedin-extension-3.9.26.zip`
   - `public/linkedin-extension.zip`

4. Verifica finale:
   - controllare dentro entrambi gli ZIP che `manifest.json` sia `3.9.26`;
   - controllare dentro entrambi gli ZIP che `content.js` contenga `msg.method = data.method`;
   - controllare che Settings mostri/scarichi `linkedin-extension-3.9.26.zip`.

Risultato atteso: i tre test non falliranno più con `method mancante`; arriveranno al vero test del click (`physical_click`, `form_submit`, `keyboard_shortcut`).