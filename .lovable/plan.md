
Obiettivo: chiudere il loop una volta sola, fare audit reale degli asset estensione e riallineare codice, cataloghi e ZIP così non esistono più versioni fantasma né fallback che servono file obsoleti.

Diagnosi già confermata dal codice:
- `src/lib/whatsappExtensionZip.ts` dichiara WhatsApp corrente `5.5.1` e LinkedIn `3.4.0`.
- `public/chrome-extensions/catalog.json` è incoerente: per WhatsApp pubblica ancora `5.4.0` come “corrente” e punta a `/whatsapp-extension.zip`.
- In `public/chrome-extensions/whatsapp/` esistono `5.5.1`, `5.3.2`, `1.1`; il file `5.4.0` non esiste proprio, ma è ancora pubblicizzato.
- I download usano fallback root (`/whatsapp-extension.zip`, `/linkedin-extension.zip`): se il path versionato fallisce, può partire uno ZIP root vecchio/sbagliato e l’utente scarica roba incoerente.
- C’è anche un test rotto/stantio: `src/test/misc-modules.test.ts` si aspetta ancora `5.4.0`.

Piano di correzione:
1. Unificare la “source of truth” delle versioni
- Allineare `public/chrome-extensions/catalog.json` alle versioni reali:
  - WhatsApp corrente `5.5.1`
  - LinkedIn corrente `3.4.0`
- Rimuovere dal catalogo ogni entry che non ha un file fisico reale.
- Rendere coerente il catalogo statico con `DEFAULT_EXTENSION_CATALOG` in `src/lib/whatsappExtensionZip.ts`.

2. Audit reale degli ZIP e rigenerazione pulita
- Verificare il contenuto interno degli ZIP attuali leggendo almeno:
  - `manifest.json`
  - file critici modificati di recente
- Rigenerare gli ZIP direttamente dalle cartelle sorgente corrette:
  - `public/whatsapp-extension/`
  - `public/linkedin-extension/`
- Pubblicare nuovamente:
  - file versionati in `public/chrome-extensions/...`
  - file root `public/whatsapp-extension.zip` e `public/linkedin-extension.zip`
- Regola: i file root devono essere alias esatti della versione corrente, non copie vecchie.

3. Eliminare i fallback ambigui o renderli sicuri
- Rifattorizzare `src/lib/whatsappExtensionZip.ts` per evitare che un fallback “silenzioso” serva uno ZIP obsoleto.
- Possibili regole implementative:
  - usare prima il file versionato;
  - mantenere il fallback root solo se è garantito identico alla versione corrente;
  - migliorare il logging per distinguere “404”, “failed to fetch”, “fallback usato”.
- Per WhatsApp manterrò il fallback embedded solo come ultima rete di sicurezza, ma coerente con la versione corrente.

4. Correggere i punti UI che oggi mascherano il problema
- Aggiornare i punti di download in:
  - `src/components/settings/ExtensionsTab.tsx`
  - `src/components/settings/ChannelsTab.tsx`
  - `src/components/settings/LinkedInTab.tsx`
  - `src/components/settings/ExtensionDownloadCatalog.tsx`
- Obiettivo:
  - stesso comportamento ovunque;
  - stesso naming/versione mostrata;
  - toast più chiari se manca il file vero.

5. Sistemare i test stantii
- Aggiornare `src/test/misc-modules.test.ts` da `5.4.0` a `5.5.1`.
- Cercare altri riferimenti residui a versioni vecchie (`5.4.0`, `1.1`, ecc.) e riallinearli solo dove corretto.

Verifica finale che farò dopo l’implementazione:
- controllo che i file esistano davvero nei path serviti dalla UI;
- controllo del `manifest.json` dentro ogni ZIP corrente:
  - WhatsApp = `5.5.1`
  - LinkedIn = `3.4.0`
- controllo che catalogo UI e file reali coincidano;
- prova download da Settings senza “File non disponibile” sui file correnti;
- verifica che non esistano più riferimenti “corrente” a versioni inesistenti.

File coinvolti:
- `src/lib/whatsappExtensionZip.ts`
- `public/chrome-extensions/catalog.json`
- `src/components/settings/ExtensionsTab.tsx`
- `src/components/settings/ChannelsTab.tsx`
- `src/components/settings/LinkedInTab.tsx`
- `src/components/settings/ExtensionDownloadCatalog.tsx`
- `src/test/misc-modules.test.ts`
- ZIP statici in `public/whatsapp-extension.zip`, `public/linkedin-extension.zip`, `public/chrome-extensions/whatsapp/*`, `public/chrome-extensions/linkedin/*`

Nota operativa:
- la parte decisiva non è solo “cambiare testo nel catalogo”: va rifatto il packaging degli ZIP e verificato il contenuto interno. In questa modalità read-only posso solo diagnosticare; appena approvi, passo all’implementazione completa e alla verifica profonda degli asset reali.
