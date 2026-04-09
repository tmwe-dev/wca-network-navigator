
Obiettivo

- Correggere i 3 problemi emersi dai log LinkedIn:
  1. `ERR_NO_CONFIG` durante `syncCookie`
  2. `cookieSynced: true` mostrato anche quando il sync non è stato realmente verificato
  3. inbox LinkedIn letta come vuota (`threads: []`) nonostante la pagina messaging sia aperta

Fonte di verità

- Nel frontend deve esistere un solo bridge LinkedIn condiviso: stesso handshake `setConfig`, stessa logica di ping, stessi timeout, stessa gestione delle risposte.
- Per la lettura inbox, la fonte di verità non può più essere il vecchio pattern `a[href*="/messaging/thread/"]`, ma la struttura reale della pagina LinkedIn attuale (AX tree + elementi conversazione reali).

Cosa ho verificato

- `src/hooks/useLinkedInExtensionBridge.ts` contiene già il fix `sendConfig()`.
- Il problema attuale nasce perché non tutti i percorsi usano quel hook:
  - `src/pages/TestExtensions.tsx` usa `liMsg(...)` diretto
  - `src/hooks/useLinkedInMessagingBridge.ts` usa `sendToLinkedInExt(...)` diretto
- Quindi il test che hai mostrato può ancora chiamare `syncCookie` senza aver prima inviato `setConfig`.
- In `public/linkedin-extension/auth.js`, il ramo `already_logged_in` restituisce `cookieSynced: true` in modo hardcoded: è un falso positivo.
- In `public/linkedin-extension/actions.js` e `public/linkedin-extension/ax-tree.js`, la lettura inbox dipende ancora troppo da link `/messaging/thread/`, che sulla UI corrente non bastano più; per questo ottieni `success: true` ma nessun thread.

Piano di correzione

1. Unificare tutto il bridge LinkedIn nel frontend
- Estrarre una base condivisa per:
  - `postMessage`
  - request/response
  - timeout
  - ping
  - `setConfig`
  - availability
- Riutilizzarla in:
  - `useLinkedInExtensionBridge`
  - `useLinkedInMessagingBridge`
  - `src/pages/TestExtensions.tsx`

2. Sistemare il test page
- Fare in modo che la tab LinkedIn di `/test-extensions` non usi più un canale “grezzo” separato.
- Il test dovrà passare dallo stesso bootstrap del bridge ufficiale, così `syncCookie`, `autoLogin` e test futuri partono sempre con config pronta.

3. Rendere veritiero `cookieSynced`
- In `public/linkedin-extension/auth.js`:
  - rimuovere il `cookieSynced: true` hardcoded
  - valorizzare `cookieSynced` solo dal risultato reale di `syncCookieToServer()`
  - se la sessione è valida ma il sync fallisce, restituire stato coerente (`authenticated: true`, `cookieSynced: false`, motivo esplicito)

4. Rifare la lettura inbox sulla UI LinkedIn attuale
- Aggiornare `AXTree.readInbox` e `Actions.readInbox` per cercare:
  - righe conversazione reali
  - nome contatto
  - preview ultimo messaggio
  - stato unread
  - identificatore / URL thread disponibile
- Non usare più come criterio primario i soli anchor `/messaging/thread/`.
- Tenere fallback multipli, ma costruiti sulla struttura reale della messaging sidebar.

5. Migliorare la diagnostica
- Quando non trova thread, la risposta non deve essere solo `success: true` con array vuoto.
- Restituire anche dettagli utili: metodo usato, candidati analizzati, perché sono stati scartati.
- Questo aiuta sia `/test-extensions` sia i flussi veri (`useLinkedInSync`, `useLinkedInBackfill`, reply inbox).

File coinvolti

- `src/hooks/useLinkedInExtensionBridge.ts`
- `src/hooks/useLinkedInMessagingBridge.ts`
- `src/pages/TestExtensions.tsx`
- `public/linkedin-extension/auth.js`
- `public/linkedin-extension/actions.js`
- `public/linkedin-extension/ax-tree.js`
- opzionale: nuovo modulo condiviso tipo `src/lib/linkedinBridge/*`

Risultato atteso

- `syncCookie` non mostra più `ERR_NO_CONFIG`
- tutti i punti dell’app che parlano con l’estensione LinkedIn usano lo stesso codice
- `autoLogin` non dichiara più `cookieSynced: true` quando non è vero
- l’inbox LinkedIn torna a trovare conversazioni reali
- sync manuale, backfill e reply LinkedIn tornano coerenti con la stessa fonte di verità
