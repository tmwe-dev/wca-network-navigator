

## Allineare il Download dell'Estensione RA al Formato WCA

### Problema

Il file `download-ra-extension.html` usa template literals ES6 (backtick) per definire il contenuto dei file dell'estensione, mentre `download-wca-extension.html` usa il formato piu' robusto con stringhe tradizionali (`var`, `\n\` line continuation, concatenazione). Questo puo' causare problemi di escape e parsing.

### Fix

**File: `public/download-ra-extension.html`**

Riscrivere il blocco `FILES` usando lo stesso pattern di `download-wca-extension.html`:
- Sostituire `const` con `var`
- Sostituire i template literals (backtick) con stringhe tradizionali e `\n\` line continuation
- Usare variabili `SUPABASE_URL` e `SUPABASE_ANON_KEY` in cima (come fa WCA) e concatenarle nelle stringhe
- Il manifest diventa `JSON.stringify({...}, null, 2)`
- Il resto dei file (background.js, content.js, popup.html, popup.js) diventa stringa con escape e concatenazione

La logica di download (`downloadFile`, `downloadAll`, icon fallback) resta identica perche' e' gia' corretta.

### Dettaglio tecnico

Il formato target e' quello di `download-wca-extension.html`:

```text
var SUPABASE_URL = "https://...";
var SUPABASE_ANON_KEY = "...";

var FILES = {
  "manifest.json": JSON.stringify({ ... }, null, 2),
  "background.js": "// commento\n\
var SUPABASE_URL = \"" + SUPABASE_URL + "\";\n\
...",
  "content.js": "// ...\n\
...",
  "popup.html": "<!DOCTYPE html>\n\
...",
  "popup.js": "var statusBox = ...\n\
..."
};
```

Questo garantisce che i file generati siano identici a quelli nella cartella `public/ra-extension/` e non ci siano problemi di escape.

