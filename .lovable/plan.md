Audit 1 — Tab/navigation

Problema certo:
- `TabManager.getLinkedInTab()` dice “no new tab”, ma in realtà marca come owned qualsiasi tab LinkedIn esistente e poi può navigarla con `chrome.tabs.update({ url })`.
- Questo evita `active:true`, quindi non ruba focus, ma cambia comunque la pagina LinkedIn aperta dall’utente.
- Inoltre `safeCreate()` esiste ancora e può creare una tab inattiva se qualche chiamata usa `allowCreate !== false`; nel flusso invio oggi è disattivato, ma il codice resta una fonte di regressione.
- Il caso più grave è `readThread/backfillThread`: se l’URL è un profilo, chiamano `getLinkedInTab(threadUrl, isProfileUrl, false)`. Con `isProfileUrl=true`, `skipNavigateIfSameDomain=true`, quindi può riusare una pagina LinkedIn già aperta senza navigare al profilo target. Poi `clickMessage()` lavora sulla pagina sbagliata o sul composer già aperto.

Effetto osservabile:
- “Leggi thread” su profilo può leggere il thread/composer già aperto, non necessariamente quello richiesto.
- “Backfill thread” stesso rischio.
- La navigazione automatica al profilo ha risolto “button not found” ma ha reintrodotto cambio pagina/comportamenti incrociati.

Audit 2 — Doppio composer / doppia pagina interna

Problema certo:
- La guardia `composerAlreadyOpen` è troppo generica: cerca `.msg-form`, `[role='dialog']`, overlay e qualsiasi composer visibile.
- Se esiste già un composer aperto, il codice salta `clickMessage()` e scrive nel composer esistente, senza verificare che sia del destinatario corrente.
- Se invece non lo riconosce, `clickMessage()` clicca “Invia messaggio/Messaggia” e LinkedIn apre un secondo composer. Questo spiega lo screenshot: due finestre messaggio aperte dentro LinkedIn.

Punto specifico:
- In `HybridOps.clickMessage()`, se trova un composer qualunque ritorna `success: true, method: "composer_already_open"`.
- In `Actions.sendLinkedInMessage()`, quel successo viene trattato come se fosse il composer corretto.
- Manca una regola “un solo composer valido per quel destinatario”: o riuso verificato per nome/URL/thread, o chiusura dei composer stale, o abort diagnostico. Oggi è un riuso cieco.

Audit 3 — Invio testo scritto ma non spedito

Problema certo:
- La produzione prova prima `AXTree.typeMessage()`. Questo inserisce testo e clicca il primo bottone AX “Send/Invia” trovato.
- Se AX scrive ma non invia, la fallback DOM può riscrivere/gestire uno stato già contaminato.
- Il metodo DOM verifica il successo solo guardando se la textbox si svuota. È meglio di prima, ma non basta: se il click non è trusted o React/LinkedIn non aggiorna lo stato, il testo resta lì e il metodo fallisce dopo aver lasciato il composer pieno.
- I metodi diagnostici `form_submit` e `keyboard_shortcut` usano eventi sintetici (`SubmitEvent`, `KeyboardEvent`) che LinkedIn può ignorare. Il metodo più promettente resta CDP/physical click perché produce input più vicino a un evento reale.

Packaging/versioni

Verificato:
- `manifest.json` è JSON valido.
- `public/linkedin-extension.zip` e `public/chrome-extensions/linkedin/linkedin-extension-3.9.36.zip` contengono manifest valido v3.9.36.
- Non ci sono `.bak` dentro gli zip.

Problema residuo:
- Nel sorgente c’è ancora `actions.primoTentativoLinkedInRiuscito.bak.js`, non incluso nello zip ma presente nel tree. Non rompe l’estensione installata, però confonde audit/grep e aumenta rischio di copiare codice vecchio.

Piano minimo di correzione

1. Introdurre un contratto unico per tab LinkedIn
- Nessuna azione LinkedIn deve creare tab nuove durante test/invio/lettura.
- Se non esiste già una tab LinkedIn: errore esplicito.
- Separare due modalità:
  - `reuseOnlyNoNavigate`: usa la tab corrente senza cambiare pagina, per azioni diagnostiche non distruttive.
  - `navigateExistingOnly`: naviga solo una tab LinkedIn già esistente, mai create, mai active:true.
- Applicare esplicitamente questa scelta a `sendMessage`, `readThread`, `backfillThread`, `extractProfile`.

2. Bloccare il riuso cieco del composer
- Prima di scrivere, rilevare tutti i composer aperti.
- Se più di uno è aperto: non scrivere alla cieca.
- Per profilo target:
  - preferire apertura del composer dal bottone profilo target;
  - se esiste già un composer, verificarne header/nome contro il target quando disponibile;
  - se non verificabile, chiudere solo i composer stale oppure abortire con errore diagnostico chiaro.
- Obiettivo: mai scrivere nel composer sbagliato e mai aprire due composer.

3. Rendere l’invio deterministico e non regressivo
- Disabilitare AX come primo metodo di produzione per invio, perché può scrivere ma non spedire e lascia stato sporco.
- Produzione: usare una sequenza unica e osservabile:
  1. trova textbox scoped al composer valido;
  2. pulisce e scrive testo;
  3. attende bottone `Invia` abilitato;
  4. prova CDP physical click sul bottone;
  5. verifica svuotamento textbox;
  6. solo se fallisce, prova CDP Ctrl/Cmd+Enter;
  7. se ancora fallisce, lascia errore senza dichiarare successo.
- Lasciare `form_submit` e `keyboard_shortcut` solo come diagnostici, non fallback produzione.

4. Sistemare `readThread` e `backfillThread`
- Se riceve `/messaging/thread/...`: navigare alla thread esatta su tab esistente.
- Se riceve `/in/...`: non usare `skipNavigateIfSameDomain=true`; deve andare al profilo target o dichiarare che sta leggendo il composer già aperto solo se verificato.
- Nel test UI, `Backfill thread` non deve chiedere URL se esiste `sendUrl` fisso valido: il fallback già esiste lato UI, ma il background rifiuta se `threadUrl` arriva vuoto. Va garantito che il target risolto venga sempre passato.

5. Pulizia anti-regressione
- Non toccare WhatsApp.
- Non toccare funzioni email/IMAP.
- Non cambiare architettura UI.
- Rimuovere dal pacchetto qualsiasi riferimento vecchio non necessario e rigenerare zip con versione nuova.
- Validare prima del rilascio:
  - manifest JSON valido;
  - zip contiene solo file runtime;
  - nessun `chrome.tabs.create` raggiungibile dai flussi di test LinkedIn;
  - nessun `active:true` nei flussi LinkedIn;
  - produzione non usa `form.requestSubmit()`;
  - produzione non dichiara successo se textbox non si svuota.

File da toccare solo dopo approvazione

- `public/linkedin-extension/tab-manager.js`
- `public/linkedin-extension/actions.js`
- `public/linkedin-extension/hybrid-ops.js`
- `public/linkedin-extension/manifest.json`
- `public/chrome-extensions/catalog.json`
- `src/lib/whatsappExtensionZip.ts`
- rigenerazione zip LinkedIn

Questo piano è volutamente minimale: prima stabilizziamo tab/composer/invio, poi si torna ai test dei tre click.