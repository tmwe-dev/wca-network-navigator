Diagnosi secca: l’errore ora non è più il packaging né `profile_not_ready`. Il flusso arriva al click, ma `sendLinkedInMessageWithMethod` pretende che il composer sia già visibile prima di chiamare `HybridOps.sendMessageWithMethod`. Su LinkedIn il click su “Messaggia” può aprire il composer come overlay lento, dialog senza textbox iniziale, o thread `/messaging/thread/`; il probe attuale in `actions.js` è troppo stretto e fallisce prima che il writer robusto di `hybrid-ops.js` possa intervenire.

Modifica proposta, unica e chirurgica:

1. In `public/linkedin-extension/actions.js`, solo dentro `sendLinkedInMessageWithMethod`:
   - sostituire il fail immediato `composer_not_open` con un fallback controllato verso `HybridOps.sendMessage(tab.id, message)`.
   - Motivo: `HybridOps.sendMessage` ha già il percorso robusto: aspetta il textbox fino a ~20s, tenta click “Messaggia”, tenta menu “Altro”, scrive il testo, trova il bottone Invia, poi usa click/form/Ctrl-Enter/CDP fallback. È esattamente il percorso che serve quando il composer non si monta subito.
   - Non duplico invii: il fallback parte solo se `composerAlreadyOpen === false`, quindi il metodo diagnostico non ha ancora scritto né inviato nulla.

2. Sempre in `actions.js`, rendere `probeComposer()` più realistico:
   - usare deep query con shadow root come fa `HybridOps.sendMessageWithMethod`.
   - riconoscere composer solo se c’è una textbox visibile, non solo dialog/overlay.
   - aggiungere diagnostica nell’errore finale solo se anche il fallback fallisce.

3. Packaging obbligatorio:
   - bump versione LinkedIn a `3.9.47`.
   - aggiornare `src/lib/whatsappExtensionZip.ts` e `public/chrome-extensions/catalog.json`.
   - rigenerare `public/chrome-extensions/linkedin/linkedin-extension-3.9.47.zip` e `public/linkedin-extension.zip`.
   - verificare dentro lo ZIP che ci sia davvero il fallback a `HybridOps.sendMessage`.

Cosa NON tocco:
- nessuna rubrica, DB, dedup, KPI, statistiche outbound.
- nessun cambio a `sendLinkedInMessage` produzione.
- nessun cambio a Partner Connect.
- nessun invio doppio: fallback solo prima di scrivere testo.

Esito atteso:
- `Invia LI` non si ferma più a `composer_not_open` quando il composer è lento.
- Se LinkedIn impedisce davvero il composer, l’errore successivo sarà diagnostico dal writer robusto (`Fallback: no textbox found __probe__=...`) invece del generico “ritenta”.
- Dopo approvazione: scaricare/reinstallare la nuova estensione `3.9.47`.