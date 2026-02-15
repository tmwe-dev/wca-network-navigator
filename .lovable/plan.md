
# Eliminazione Retry dall'Estensione Chrome

## Problema identificato

Il file `public/chrome-extension/background.js` contiene un loop di retry interno (righe 155-212):

```javascript
var MAX_RETRIES = 1;        // ← permette 1 retry
var RETRY_DELAYS = [5000];  // ← dopo 5 secondi
for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // apre un TAB per ogni tentativo
    tab = await chrome.tabs.create({ url: "..." });
    ...
    if (!pageLoaded && attempt < MAX_RETRIES) {
        chrome.tabs.remove(tab.id);
        continue;  // ← APRE UN SECONDO TAB
    }
}
```

Per ogni profilo WCA, se la pagina non carica al primo tentativo, l'estensione:
1. Apre il tab 1 -- la pagina non carica
2. Chiude il tab 1
3. Aspetta 5 secondi
4. Apre il tab 2 -- secondo tentativo

Questo viola la politica "Zero Retry" e spiega le aperture extra che vedi nel browser.

## Soluzione

Rimuovere completamente il loop di retry da `extractContactsForId()`:

- `MAX_RETRIES` da 1 a 0 (o rimuovere il loop del tutto)
- Un solo tab per profilo: se non carica, restituisce `pageLoaded: false` e l'app lo marca come `skipped`
- La funzione diventa lineare: apri tab, aspetta, estrai, chiudi tab, fine

### Codice risultante (semplificato)

La funzione `extractContactsForId` diventa:
1. Apre un singolo tab
2. Aspetta il caricamento (max 30s)
3. Verifica se la pagina e' caricata
4. Se si': estrae i contatti
5. Se no: restituisce `pageLoaded: false`
6. Chiude il tab
7. Nessun loop, nessun retry

### File modificato

1. `public/chrome-extension/background.js` -- rimozione loop retry da `extractContactsForId`, funzione linearizzata

### Nota importante

Dopo la modifica, dovrai reinstallare l'estensione Chrome (vai su `chrome://extensions`, rimuovi la vecchia e carica di nuovo la cartella `chrome-extension`) perche' le modifiche al background script non si applicano automaticamente.
