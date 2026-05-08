Piano LinkedIn unificato — versione finale dopo correzioni utente.

## Principio guida

Una sola linea per LinkedIn: **canale `from-webapp-li` → estensione dedicata "LinkedIn Cookie Sync"**.
Partner Connect non gestisce più LinkedIn, neanche apparentemente.
Backend `send-linkedin` resta intatto ma fuori scope, con nota esplicita.

## Diagnosi confermata

1. **LinkedIn Cookie Sync** è il canale buono: usa `chrome.scripting.executeScript` + AX Tree, non ha bisogno di content script su `linkedin.com`.
2. **Partner Connect `handleLiRelay`** invia `chrome.tabs.sendMessage(liTab.id, { type: "li-command" })` a una tab dove **nessuno ascolta**. Il manifest non inietta nulla su `linkedin.com`. Risultato: 100% fallimento silenzioso ("Receiving end does not exist").
3. **`send-linkedin`** accoda su `extension_dispatch_queue`, ma nel repo non esiste un consumer LinkedIn. Tutto ciò che passa di lì resta `pending` per sempre.
4. **Test diagnostici** in Settings: bug `method` patchato in 3.9.26/3.9.27 + tab/composer non coerenti col profilo richiesto patchati in 3.9.27.

## Step 1 — Validare davvero la baseline 3.9.27

Il ping non basta. Il test diagnostico deve completare in ordine, su un profilo reale:

1. apertura del profilo richiesto (navigazione corretta, non riuso casuale di una tab);
2. verifica URL profilo corrente (`/in/<slug>` o thread coerente);
3. apertura del composer corretto (non un overlay di un'altra chat);
4. rilevamento textbox composer (non search bar, non altro `role=textbox`);
5. inserimento testo nel textbox;
6. click/submit/shortcut sul send button → `success: true` **oppure** errore DOM reale e identificato (`send_button_not_found`, `textbox_not_cleared`, `wrong_recipient`, `navigation_drifted`).

Se uno di questi 6 step fallisce, il problema è dentro l'estensione dedicata e va patchato lì, in `actions.js` / `hybrid-ops.js`, sul ramo specifico dell'errore. Niente refactor della cascata.

Solo se gli step 1-6 reggono si passa allo Step 2.

## Step 2 — Neutralizzare il relay LinkedIn di Partner Connect

Modifica chirurgica e reversibile. Non si rimuovono permessi né content script.

- `public/partner-connect-extension/webapp-bridge.js` — `relayLinkedIn(data)`: rispondere subito con `{ success: false, error: "linkedin_handled_by_dedicated_extension" }`, niente `chrome.runtime.sendMessage` verso il background per LinkedIn.
- `public/partner-connect-extension/background.js` — `handleLiRelay(msg)`: stessa risposta esplicita immediata, niente `chrome.tabs.sendMessage`.
- Bump versione Partner Connect, nota changelog: "LinkedIn delegato all'estensione dedicata".

Reversibile: bastano due rimozioni per tornare al comportamento precedente.

## Step 3 — Audit lato webapp

Cercare non solo `direction: "from-webapp"` per azioni LinkedIn, ma **qualsiasi** `postMessage`/`chrome.runtime.sendMessage` che usi azioni tipiche LinkedIn (`sendMessage`, `extractProfile`, `sendConnectionRequest`, `searchProfile`, `readLinkedInInbox`, `readLinkedInThread`) senza il canale `from-webapp-li`.

Cercare anche in:
- `src/hooks/**` (hook bridge);
- `src/components/**` (dialog/cockpit);
- `supabase/functions/**` per edge function che producano payload destinati al canale sbagliato (es. tool handlers, agent execute);
- qualsiasi `chrome.runtime.sendMessage` con `type: "li-relay"`.

Risultato atteso: zero punti che parlano LinkedIn fuori da `useLinkedInExtensionBridge` (canale `from-webapp-li`).

## Step 4 — Documentazione e protezione

- Nota in testa a `webapp-bridge.js` e `background.js` di Partner Connect: "LinkedIn non è gestito qui — vedi LinkedIn Cookie Sync".
- Nota di memoria progetto: "LinkedIn passa solo da `from-webapp-li`. Partner Connect = scraping / deep search / web automation".
- **Nota esplicita** sul debito noto: `send-linkedin` accoda in `extension_dispatch_queue` ma non esiste un consumer LinkedIn. Qualunque invio LinkedIn dal backend resta `pending` finché non si decide se costruire il consumer o smontare la coda. **Fuori scope di questo intervento, ma documentato per non riscoprirlo tra due settimane.**

## Cosa NON si fa adesso

- Non si replica `HybridOps`/`AXTree` dentro Partner Connect.
- Non si abilita `externally_connectable` cross-extension.
- Non si tocca `send-linkedin` né le altre edge function.
- Non si toccano `check-inbox`, `email-imap-proxy`, `mark-imap-seen`.
- Non si toccano RLS, journalist review, hard guards AI.
- Niente refactor opportunistici.

## Verifica finale prima di chiudere

1. Test "Click fisico / Form submit / Ctrl+Enter" in Settings completa i 6 step dello Step 1 (o dà errore DOM reale e nominato).
2. Nessun punto della webapp invia LinkedIn via `direction: "from-webapp"` o `type: "li-relay"`.
3. `handleLiRelay` di Partner Connect risponde con errore esplicito immediato, mai più `sendMessage` al vuoto.
4. Versione LinkedIn Cookie Sync mostrata in Settings = ZIP scaricabile = manifest installato (3.9.27).
5. Memoria/changelog aggiornati con la regola di canale e il debito noto sulla coda.