

# Piano: Fix ERR_NO_CONFIG + cookieSynced + Inbox LinkedIn

Il fix `sendConfig` esiste già in `useLinkedInExtensionBridge.ts` ma viene bypassato da due punti che usano canali separati.

## Problema 1: ERR_NO_CONFIG

`TestExtensions.tsx` usa `liMsg()` (riga 49) e `useLinkedInMessagingBridge.ts` usa `sendToLinkedInExt()` (riga 21) — entrambi inviano postMessage direttamente senza mai chiamare `setConfig`. L'hook con il fix non viene usato in questi contesti.

**Fix**: Aggiungere invio `setConfig` in entrambi i punti prima di qualsiasi azione.

### File: `src/pages/TestExtensions.tsx`
- Nel tab LinkedIn, prima del primo `liMsg()`, inviare `setConfig` con le credenziali Supabase
- Aggiungere una funzione `ensureLiConfig()` che invia setConfig una volta e la chiama prima di ogni test

### File: `src/hooks/useLinkedInMessagingBridge.ts`
- Nel listener `contentScriptReady` / `ping` success (riga 233), inviare `setConfig` come fa il bridge principale
- Aggiungere `configSentRef` e la stessa logica di `sendConfig()`

## Problema 2: cookieSynced hardcoded

### File: `public/linkedin-extension/auth.js`
- Riga 237: `cookieSynced: true` è hardcoded nel ramo `already_logged_in`
- Fix: chiamare `syncCookieToServer()` e usare il risultato reale: `cookieSynced: !!syncResult.success`

## Problema 3: Inbox vuota

### File: `public/linkedin-extension/actions.js`
- La lettura inbox restituisce `threads: []` perché i selettori DOM sono obsoleti
- Aggiungere fallback basato su elementi lista conversazione reali (`li` items nella sidebar messaging)
- Quando zero thread trovati, restituire metadata diagnostica (metodo usato, candidati trovati, motivo esclusione)

### File: `public/linkedin-extension/ax-tree.js`
- Stessa logica: aggiornare i selettori per la struttura DOM attuale di LinkedIn messaging

## File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/TestExtensions.tsx` | Aggiungere `ensureLiConfig()` prima dei test LinkedIn |
| `src/hooks/useLinkedInMessagingBridge.ts` | Aggiungere `sendConfig` su detection estensione |
| `public/linkedin-extension/auth.js` | Rimuovere `cookieSynced: true` hardcoded, usare risultato reale |
| `public/linkedin-extension/actions.js` | Aggiornare selettori inbox + diagnostica |
| `public/linkedin-extension/ax-tree.js` | Aggiornare selettori inbox fallback |

## Risultato
- `syncCookie` non mostra più `ERR_NO_CONFIG` da nessun punto dell'app
- `cookieSynced` riflette lo stato reale del sync
- Inbox LinkedIn torna a trovare conversazioni con selettori aggiornati

