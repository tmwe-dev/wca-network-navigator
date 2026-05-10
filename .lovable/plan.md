Diagnosi fatta sui pacchetti LinkedIn:

1. Backup trovato
- Esiste un backup esplicito: `public/chrome-extensions/linkedin/backups/linkedin-messaggio-backup-2-3.9.24.zip`.
- Quella versione aveva un flusso più semplice e stabile: apriva/riusava il composer e poi chiamava direttamente `HybridOps.sendMessage`.
- Il punto importante: la scrittura del testo era dentro `HybridOps.sendMessage`, con una cascata robusta `paste → execCommand → Selection API → textContent`.

2. Ultime due versioni confrontate
- `3.9.60` e `3.9.61` sono identiche su `tab-manager.js` e `background.js`.
- Quindi keep-alive e worker tab non sono la causa di questo errore.
- La differenza reale è in `actions.js` e `hybrid-ops.js`.

3. Causa precisa del log attuale
Il log dice:

```text
composer_gate_failed_diagnostic: composer_gate_timeout
status=complete
gate={"boxes":0,"clickedMessage":false,"clickedMore":false,"hasMain":true,"shells":0}
```

Questo significa:
- LinkedIn è caricato (`status=complete`, `hasMain=true`).
- La pagina profilo c'è.
- Però il gate diagnostico non trova nessun composer (`boxes=0`, `shells=0`).
- E non riesce nemmeno a cliccare `Messaggia` / `Altro` (`clickedMessage=false`, `clickedMore=false`).

Il problema non è CDP: il CDP non parte proprio, perché prima fallisce l'apertura/rilevamento del composer.

4. Cosa si è rotto tra 3.9.60 e 3.9.61
In `3.9.60`, quando il gate composer falliva, il codice faceva ancora fallback a:

```text
HybridOps.sendMessage(tab.id, message)
```

Quel fallback era la parte “che scriveva davvero”, perché dentro aveva la logica lunga e robusta per trovare il textbox, aprire il composer e scrivere.

In `3.9.61`, quel fallback è stato rimosso per far fallire i test CDP velocemente. Risultato: ora il test è più diagnostico, ma ha perso la via stabile che provava davvero a scrivere.

Piano di ripristino minimo:

1. Ripristinare la via di scrittura stabile
- Rimettere in `sendLinkedInMessageWithMethod` il fallback a `HybridOps.sendMessage(tab.id, message)` quando il gate diagnostico fallisce.
- Farlo solo dopo aver riportato l’errore diagnostico, senza duplicare invii.
- Questo recupera il comportamento funzionante della 3.9.60/backup.

2. Separare chiaramente test diagnostico e invio reale
- Il pulsante CDP deve restare diagnostico.
- Il pulsante di invio reale deve usare la pipeline stabile `sendMessage`.
- Se CDP non trova il composer, non deve bloccare tutta la capacità di scrivere.

3. Rendere `clickMessage` verificabile
- Oggi `clickMessage` può tornare `success: true` appena clicca un bottone, anche se il composer non si apre.
- Aggiungo una verifica breve dopo il click: se dopo il click non appare textbox/composer, ritorna errore specifico invece di falso successo.

4. Mantenere invariati i pezzi che ora funzionano
- Non tocco `background.js` keep-alive.
- Non tocco `tab-manager.js` worker tab.
- Non tocco `readInbox` bounded.
- Non tocco la scrittura robusta dentro `HybridOps.sendMessage`, perché è proprio la parte da preservare.

5. Nuovo pacchetto
- Versione nuova `3.9.62`.
- Catalog e fallback zip aggiornati.
- Zip verificato: manifest `3.9.62`, fallback coerente, nessuna versione attiva sbagliata.

Risultato atteso:
- Il CDP non resta più appeso.
- Se il gate CDP non trova il composer, si capisce subito.
- Ma la possibilità di scrivere/inviare torna tramite la pipeline stabile che era ancora presente in `3.9.60` e derivata dal backup funzionante.