## Esito audit

Ho confrontato gli ZIP reali registrati, non solo i sorgenti:

- `linkedin-extension-3.9.56.zip` e `linkedin-extension-3.9.56-restore.zip` sono la baseline funzionante: stesso `actions.js`, `hybrid-ops.js`, `tab-manager.js`, `background.js`, `content.js`.
- `public/linkedin-extension.zip` contiene davvero la `3.9.65`, quindi il problema attuale non è più “ZIP vecchio”.
- La regressione principale parte dalla `3.9.57`: `TabManager.getLinkedInTab()` intercetta anche URL profilo `/in/...` e li manda sulla worker tab persistente.
- Questo spiega il comportamento: lettura inbox/thread veloce perché la worker tab su `/messaging/` va bene per leggere; scrittura/click si rompe perché il flusso non lavora più sul profilo come nella baseline, ma finisce su `/messaging/thread/new/?recipient=...`, dove non esistono i bottoni profilo “Messaggia/Altro”.
- Il log conferma: `url="https://www.linkedin.com/messaging/thread/new/?recipient=..."`, `visibleButtonsCount=0`, `clickedMessage=false`, `messageClickAttempts=0`. Quindi non sta fallendo il writer: sta fallendo prima, nel gate che aspetta un composer su una pagina messaging nuova non montata.
- Seconda regressione: nei metodi diagnostici CDP (`cdp_ctrl_enter`, `cdp_physical_click`) la `3.9.65` fa fail-fast e non usa il fallback stabile `HybridOps.sendMessage`. Per questo il test resta inchiodato su `composer_gate_failed_diagnostic` invece di provare la pipeline che in passato scriveva.

## Nodo critico toccato

Invio LinkedIn = nodo critico: click, writer, dedup, fallback e destinatario. La correzione deve essere minima, locale e reversibile.

## Piano di implementazione

1. **Ripristinare il routing della baseline solo per la scrittura**
   - Lasciare la worker tab per `readInbox`, `readThread`, `ensureWorkerTab`, ping e pre-warm.
   - Escludere i profili `/in/...` e `/pub/...` dal routing automatico verso worker tab quando l’azione è invio/click.
   - Per `sendLinkedInMessage()` e `sendLinkedInMessageWithMethod()` tornare al comportamento `3.9.56`: usare/navigare una tab LinkedIn reale sul profilo target, poi cliccare “Messaggia”.

2. **Non toccare il writer stabile**
   - Mantenere `HybridOps.sendMessage` e `HybridOps.sendMessageWithMethod` come single writer.
   - Nessun nuovo writer parallelo.
   - Nessuna duplicazione di invio, paste, submit o CDP.

3. **Ripristinare fallback diagnostico per test click+messaggio**
   - Anche se il metodo selezionato è CDP, se il gate non trova il composer deve poter degradare a `HybridOps.sendMessage` solo dopo aver verificato destinatario/profilo.
   - Il test deve essere “click profilo → composer → scrittura → invio”, non “apri `/messaging/thread/new` e spera che monti”.

4. **Aggiungere un micro-test diagnostico mirato**
   - Un’azione dedicata o output diagnostico nel test esistente che verifica solo:
     - tab URL finale;
     - presenza profilo target;
     - click bottone Messaggia;
     - composer trovato;
     - textbox scrivibile;
     - send button trovato.
   - Deve fermarsi con errore chiaro prima dell’invio se manca uno step, così non facciamo altri tentativi ciechi.

5. **Versionare e impacchettare correttamente**
   - Bump a `3.9.66`.
   - Aggiornare `manifest.json`, `catalog.json`, `LINKEDIN_EXTENSION_REQUIRED_VERSION`.
   - Rigenerare sia `/chrome-extensions/linkedin/linkedin-extension-3.9.66.zip` sia `/linkedin-extension.zip`.
   - Verificare con script che manifest e hash dentro gli ZIP coincidano con i sorgenti.

## Cosa non cambio

- Nessuna modifica a backend, DB, RLS, edge functions, AI, prompt o email.
- Nessuna modifica a lettura inbox/thread, che oggi funziona.
- Nessuna riscrittura dell’architettura dell’estensione.
- Nessun refactor opportunistico.

## Risultato atteso

Il sistema torna al flusso funzionante:

```text
profilo /in/... → click Messaggia sul top-card → composer visibile → scrittura messaggio → invio
```

La worker tab resta utile per la lettura, ma non deve più sostituire il profilo nel percorso di scrittura.