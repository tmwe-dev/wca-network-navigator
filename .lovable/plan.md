

# Fix: Rilevamento Estensione Chrome

## Il Bug

Il polling nell'hook `useExtensionBridge` e' rotto. Ecco cosa succede:

1. Il content script invia `contentScriptReady` UNA SOLA VOLTA quando si carica
2. Se la webapp non ha ancora montato il listener `useEffect`, il messaggio viene perso
3. Il polling ogni 5 secondi invia ping con `window.postMessage` diretto, ma NON registra nessun callback in `pendingRef`
4. Quando la risposta torna dal background (`{success: true, version: "3.0"}`), il gestore cerca il `requestId` in `pendingRef` -- non lo trova -- ignora la risposta
5. Risultato: `isAvailable` resta `false` per sempre

Quando ha funzionato (Pelikan), probabilmente il timing era favorevole e il `contentScriptReady` e' arrivato nel momento giusto.

## Soluzione

### File: `src/hooks/useExtensionBridge.ts`

Aggiungere nel gestore messaggi (`handleMessage`) un controllo per le risposte ai ping di polling: se arriva un messaggio con `action === "ping"` e la risposta contiene `success: true`, impostare `isAvailable = true`.

```
// Nella funzione handleMessage, PRIMA del check requestId:
if (data.action === "ping" && data.response?.success) {
  setIsAvailable(true);
  return;
}
```

Questo risolve il problema alla radice: ogni risposta positiva a un ping (sia dal polling automatico sia da `checkAvailable`) verra' rilevata e attivera' l'indicatore verde.

### File: `public/chrome-extension/content.js`

Aggiungere un meccanismo di re-announce periodico: il content script invia `contentScriptReady` non solo al caricamento ma anche in risposta a ogni ping ricevuto, come backup.

## Dettagli Tecnici

### Modifica 1: `src/hooks/useExtensionBridge.ts` (handleMessage, riga ~30-46)

Aggiungere dopo il check `contentScriptReady`:

```typescript
// Any successful ping response means extension is alive
if (data.action === "ping" && data.response?.success) {
  setIsAvailable(true);
  return;
}
```

### Modifica 2: `public/chrome-extension/content.js`

Nella risposta del content script, se l'action e' "ping", includere anche un `contentScriptReady` come conferma aggiuntiva.

## Risultato Atteso

- L'estensione viene rilevata entro 5 secondi dal caricamento della pagina (al primo ping di polling che riceve risposta)
- Non dipende piu' dal timing del `contentScriptReady` iniziale
- L'indicatore "Estensione attiva" appare in modo affidabile nella toolbar di acquisizione

