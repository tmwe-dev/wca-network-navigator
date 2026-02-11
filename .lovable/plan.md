

# Semplificare il Popup dell'Estensione Chrome

## Problema
Il popup dell'estensione mostra un pulsante "Estrai Contatti" che chiede di inserire manualmente gli ID WCA. Questo non serve piu' perche' l'estrazione avviene automaticamente dalla webapp tramite il bridge (background.js + content.js).

## Soluzione
Rimuovere dal popup tutto cio' che riguarda l'estrazione manuale. Il popup deve avere SOLO il pulsante "Connetti" per autenticarsi su WCA. Nient'altro.

## Modifiche

### 1. popup.html
- Rimuovere il pulsante "Estrai Contatti"
- Rimuovere la sezione `extractConfig` (campo input per gli ID)
- Aggiornare il testo di stato iniziale: "Pronto. Clicca Connetti per autenticarti."
- Layout pulito: un solo pulsante grande

### 2. popup.js
- Rimuovere tutto il codice legato a `extractBtn`, `extractConfig`, `wcaIdsInput`
- Rimuovere la funzione `extractContactsFromPage` (gia' presente in background.js)
- Rimuovere la funzione `sendContactsToServer` (gia' presente in background.js)
- Rimuovere il listener click di `extractBtn`
- Mantenere SOLO la logica del pulsante "Connetti"

### Risultato
Il popup mostra solo:
- Titolo "WCA Cookie Sync v3"
- Stato connessione
- Un pulsante "Connetti"
- Log degli step

L'estrazione contatti avviene in automatico dalla pagina Acquisizione Partner, senza che l'utente debba fare nulla nell'estensione.

