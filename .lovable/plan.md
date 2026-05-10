## Diagnosi

Dai log l’estensione non dorme più:

- `ping` risponde subito con `v3.9.60`
- worker tab pronta e riusata in `12ms`
- sessione attiva
- cookie sync OK
- auto-login OK
- ricerca profilo OK

Il blocco è solo sull’ultimo miglio dell’invio diagnostico:

```text
Test metodo: CDP click
Timeout 45s
```

Nel codice attuale il flusso `sendMessageWithMethod` è diventato troppo lungo prima di arrivare al test CDP: navigazione worker, attese profilo, probe composer, gate fino a 30s, poi CDP. Quindi il pulsante diagnostico “CDP click” non è più un test isolato rapido: attraversa quasi tutta la pipeline pesante e può consumare i 45s della UI.

## Piano di intervento

### 1. Non toccare readInbox e keep-alive

Lascio invariati:

- `readInbox` bounded interno 3.9.59/3.9.60
- worker tab persistente
- `chrome.alarms` keep-alive v3.9.60
- download/catalog/versioning già allineati a `3.9.60`

Il problema ora non è “estensione dormiente”, ma invio diagnostico CDP appeso.

### 2. Separare i test diagnostici dalla pipeline di invio completa

Modifico `sendLinkedInMessageWithMethod` in modo che per i metodi diagnostici non passi più da tutti i gate lunghi.

Nuovo comportamento:

- naviga/usa la worker tab sul destinatario fisso
- attende solo caricamento breve e deterministico
- apre il composer se serve con budget breve
- delega subito a `HybridOps.sendMessageWithMethod`
- se il composer non si apre, ritorna errore diagnostico leggibile invece di restare appeso

Target: un test click deve fallire in pochi secondi con motivo preciso, non dopo 45s generici.

### 3. Mettere timeout interni reali sui CDP

Nel ramo `HybridOps.sendMessageWithMethod` aggiungo timeout espliciti anche alle chiamate:

- `AXTree.clickSendButtonPhysical(tabId)`
- `AXTree.pressCtrlEnter(tabId, isMac)`
- verifica `composerCleared(...)`

Così se Chrome debugger/CDP resta bloccato, la risposta torna come:

```text
cdp_physical_click_timeout_6000ms
```

invece di lasciare scadere il timeout esterno da 45s.

### 4. Ripristinare una via “produzione stabile” separata dal CDP

Il pulsante principale `Invia LI` deve continuare a usare `sendMessage`, cioè la pipeline stabile single-writer:

- una sola scrittura nel composer
- anti-double-send
- click DOM fisico ottimistico
- nessun fallback multiplo che rischia duplicati

I pulsanti CDP restano solo diagnostici, non diventano la strada principale.

### 5. Aggiornare la UI test per non confondere

Nel pannello LinkedIn:

- rinomino i pulsanti CDP come diagnostici/fallback, non come strada consigliata
- mostro nel log la distinzione:
  - pipeline principale
  - test click isolato
  - CDP fallback diagnostico
- se arriva timeout CDP, suggerisco di provare prima `Invia LI` o `Click fisico`, non di continuare con CDP

### 6. Versione nuova e pacchetto reinstallabile

Creo una nuova build:

- manifest `3.9.61`
- catalog `latestVersion: 3.9.61`
- `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.61"`
- zip `public/chrome-extensions/linkedin/linkedin-extension-3.9.61.zip`
- fallback `public/linkedin-extension.zip` aggiornato

### 7. Verifiche finali

Prima di chiudere verifico:

- manifest nello zip = `3.9.61`
- catalog JSON valido
- fallback zip contiene la stessa versione
- nessun riferimento required/latest a `3.9.60` come versione attiva
- `sendMessageWithMethod` non può più restare 45s senza risposta
- il keep-alive resta presente
- readInbox resta bounded

## Risultato atteso

Dopo reinstallazione della `3.9.61`:

- l’estensione resta sveglia come ora
- i test CDP non dormono più 45s: rispondono OK/KO con errore specifico
- il flusso principale `Invia LI` resta separato e più sicuro
- capiamo finalmente se il problema reale è composer, bottone Send, CDP debugger o click DOM