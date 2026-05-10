## Diagnosi rapida

Ho verificato i file attuali:

- L'estensione installata nel tuo log è `v3.9.59`.
- Il codice dell'app invece ora punta a `3.9.56` / `3.9.56-restore` in più punti.
- Il catalogo segna `3.9.56-restore` come latest, ma il pulsante download top-bar costruisce il nome `linkedin-extension-3.9.56.zip`, quindi c'è disallineamento.
- Il fallback `/linkedin-extension.zip` contiene davvero la `3.9.56-restore`, non la `3.9.59`.
- La lettura inbox viene interrotta dal timeout client a 12s della strategia B/D: con la `3.9.59` questo è controproducente, perché la `3.9.59` ha già il bounded readInbox interno.
- La UI attuale è troppo manuale: radio A/B/C/D + test isolati + pre-warm + read + send creano confusione e nascondono il problema reale.

## Piano di intervento

### 1. Riallineare tutto a LinkedIn 3.9.59

Rendo `3.9.59` la versione canonica attiva:

- `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.59"`
- `catalog.json` con `3.9.59` come `latestVersion` e `current: true`
- `/chrome-extensions/linkedin/linkedin-extension-3.9.59.zip` come zip scaricato dal pulsante principale
- `/linkedin-extension.zip` riallineato alla `3.9.59`
- `public/linkedin-extension/` riallineata ai sorgenti contenuti nello zip `3.9.59`

Risultato: app, catalogo, fallback, download e log versione parlano tutti della stessa build.

### 2. Eliminare la selezione manuale delle strategie dal test principale

Tolgo il blocco radio A/B/C/D dal pannello operativo principale.

Al suo posto metto una sola azione chiara:

- `Esegui diagnostica LinkedIn completa`

Questa diagnostica farà i controlli in sequenza, senza chiederti di scegliere strategia.

### 3. Creare test automatici per ogni funzione critica

La diagnostica automatica eseguirà e marcherà ogni step come `OK`, `KO`, `TIMEOUT` o `SKIP`:

1. Download metadata
   - verifica che l'app punti alla versione corretta
   - verifica percorso zip atteso
   - verifica coerenza tra required version e catalogo

2. Ping estensione
   - controlla se l'estensione risponde
   - confronta versione installata vs versione richiesta

3. Worker tab
   - esegue `ensureWorkerTab`
   - misura tempo e stato `ready`
   - se non supportato, lo segnala come incompatibilità versione

4. Sessione LinkedIn
   - esegue `verifySession`
   - distingue login mancante, checkpoint/captcha, cookie mancante, caricamento lento

5. Lettura inbox
   - chiama `readLinkedInInbox` usando la logica nativa della `3.9.59`
   - niente timeout client da 12s
   - timeout UI più realistico e diagnostico, così capiamo se risponde, se torna vuota, o se resta appesa

6. Lettura thread singolo
   - se inbox produce thread, prova il primo thread utile
   - se c'è destinatario fisso, prova quello

7. Invio diagnostico non distruttivo dove possibile
   - non mando messaggi automaticamente senza comando esplicito
   - verifico invece composer/DOM/capacità metodo quando possibile
   - l'invio reale resta un pulsante separato e protetto

### 4. Report unico leggibile

Aggiungo un pannello risultati con tabella semplice:

```text
Funzione              Stato      Tempo      Dettaglio
Download config       OK         -          punta a 3.9.59
Estensione installata OK         120ms      v3.9.59
Worker tab            OK         13ms       ready=yes
Sessione              OK         2.1s       session_active
Inbox                 KO         45s        timeout interno extension / risposta vuota / errore specifico
Thread                SKIP       -          inbox non ha restituito thread
```

Sotto la tabella mostro una conclusione automatica:

- `Problema di versione`
- `Problema download`
- `Problema sessione LinkedIn`
- `Problema worker tab`
- `Problema parser inbox`
- `Problema invio/composer`

### 5. Sistemare il download

Correggo il pulsante download in modo che non costruisca più un path incoerente.

Opzioni tecniche previste:

- usare direttamente `LINKEDIN_EXTENSION_REQUIRED_VERSION = 3.9.59`, quindi scarica `linkedin-extension-3.9.59.zip`
- mantenere cache-buster già presente
- loggare errore leggibile se il fetch fallisce

Così il download scarica la build che l'app richiede davvero.

### 6. Conservare le strategie vecchie solo come diagnostica avanzata nascosta

Non cancello subito il codice delle strategie, ma lo tolgo dal flusso principale.

Se serve, resta disponibile come area avanzata/collassata, non come scelta obbligatoria per te.

### 7. Verifiche finali

Dopo l'implementazione verifico:

- zip `3.9.59` presente e manifest corretto
- catalogo valido JSON
- costanti versione allineate
- nessun riferimento principale a `3.9.56` come required/latest
- pannello test senza selezione manuale A/B/C/D nel percorso principale
- diagnostica automatica pronta a dirci quale funzione fallisce