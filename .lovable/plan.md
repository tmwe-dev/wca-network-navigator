

# Fix: Estensione non rilevata dentro l'iframe di Lovable

## Problema
Il content script (`content.js`) si inietta solo nei tab di primo livello. Ma quando lavori nell'editor di Lovable, la preview della tua app viene caricata dentro un **iframe**. Il content script non viene mai caricato nell'iframe, quindi il bridge `window.postMessage` non funziona e l'estensione risulta "non rilevata".

## Soluzione

### `public/chrome-extension/manifest.json`
Aggiungere `"all_frames": true` alla configurazione dei content scripts. Questo fa si' che `content.js` venga iniettato anche negli iframe il cui URL corrisponde ai pattern specificati.

```json
"content_scripts": [
  {
    "matches": [
      "https://*.lovable.app/*",
      "https://*.lovableproject.com/*"
    ],
    "js": ["content.js"],
    "run_at": "document_idle",
    "all_frames": true
  }
]
```

### Dopo la modifica
Dovrai:
1. Scaricare l'estensione aggiornata da Impostazioni
2. Sostituire i file nella cartella dell'estensione
3. Ricaricare l'estensione in `chrome://extensions/` (icona di refresh)

## Dettagli tecnici
- `all_frames: true` permette a Chrome di iniettare il content script in qualsiasi frame (iframe incluso) il cui URL corrisponde ai pattern in `matches`
- Senza questa opzione, il content script si attiva solo sulla pagina principale del tab
- La preview dell'app su `*.lovable.app` viene renderizzata in un iframe dentro l'editor, percio' il bridge non si attivava mai

