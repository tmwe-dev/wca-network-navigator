## Obiettivo

Ripristinare la build LinkedIn 3.9.56 (la "migliore" per affidabilità d'invio) come versione attiva, e mettere a disposizione nell'area di test del pannello LinkedIn tre strategie alternative — così possiamo provarle in parallelo e scegliere quella che elimina la duplicazione messaggi senza reintrodurre gli hang risolti in 3.9.59.

## 1. Rollback effettivo a 3.9.56

File toccati (solo questi 5 cambiavano tra 3.9.56 e 3.9.59):
- `public/linkedin-extension/actions.js` ← versione 3.9.56
- `public/linkedin-extension/background.js` ← versione 3.9.56
- `public/linkedin-extension/content.js` ← versione 3.9.56
- `public/linkedin-extension/tab-manager.js` ← versione 3.9.56
- `public/linkedin-extension/manifest.json` ← `version: "3.9.56-restore"`

Ripacchettizzo:
- `public/linkedin-extension.zip` (zip "live" servito dal pannello)
- `public/chrome-extensions/linkedin/linkedin-extension-3.9.56-restore.zip` (archivio versionato)

Aggiorno:
- `public/chrome-extensions/catalog.json` → entry `3.9.56-restore` come `latest`
- `src/lib/whatsappExtensionZip.ts` → riferimento versione corrente

Effetto: l'estensione installata sarà quella che inviava bene (con la diagnostica AI-Verified Click già presente). Il pre-warm worker tab sparisce: il messaggio "Unknown action: ensureWorkerTab" che vedevi all'inizio era proprio causato dalla 3.9.56 che riceveva chiamate non supportate dal client più recente — gestito al punto 2.

## 2. Adattamento client al rollback

`src/components/test-extensions/LinkedInTest.tsx` (e altri eventuali punti che invocano `ensureWorkerTab` / pre-warm) devono diventare tolleranti:

- Se l'estensione risponde `Unknown action: ensureWorkerTab` → il client procede senza pre-warm (non blocca, non logga errore rosso, log informativo "estensione 3.9.56 senza pre-warm: ok").
- `readInbox` resta invocato come prima; se va in hang il timeout lo gestisce a livello UI (vedi punto 3 per le strategie alternative).

Nessuna logica AI/edge function viene toccata.

## 3. Area test: 3 strategie selezionabili

Nel pannello esistente `LinkedInTest.tsx` aggiungo un blocco "Strategia di invio (sperimentale)" con 3 radio-button. La scelta viene salvata in `localStorage` e passata come parametro all'azione di invio. Le tre opzioni:

### Strategia A — "Pure 3.9.56" (default dopo rollback)
Comportamento identico a 3.9.56 originale. Nota in UI: "⚠️ può duplicare messaggi nella stessa chat se l'AI re-learn riparte". Serve come baseline di confronto.

### Strategia B — "3.9.56 + readInbox timeout"
Wrap client-side: la chiamata `readInbox` viene avvolta in un `Promise.race` con timeout 12s; se scade, l'UI mostra "lettura inbox saltata, riprovo al prossimo ciclo" senza appendere alla chat. Risolve gli hang a 90s visti stamattina senza modificare l'extension.

### Strategia C — "3.9.56 + anti-duplicazione hard-guard"
Prima dell'invio, calcolo idempotency key client-side: `sha1(recipientUrl + normalizedText + floor(Date.now()/30000))`. La key viene salvata in `localStorage` con TTL 5 min. Se esiste già → invio bloccato con toast "messaggio identico inviato negli ultimi 30s, salto". Nessuna chiamata all'extension. Risolve la duplicazione anche se il flusso AI-relearn ritenta.

### Strategia D — "B + C combinate"
Entrambi i guard attivi insieme. Probabilmente la configurazione "definitiva" se A da sola duplica.

UI: 4 radio + un piccolo pannello "Diff vs 3.9.56" che mostra cosa fa ciascuna strategia, così durante i test si capisce subito quale è attiva. Tutto il codice delle strategie vive in un nuovo file `src/components/test-extensions/linkedinSendStrategies.ts` (puro frontend, nessun side-effect su edge function o DB).

## 4. Verifica

- Riavvio dev server, verifico che `LinkedInTest.tsx` compili.
- Confermo manifest version `3.9.56-restore` nello zip rigenerato (script Python: `unzip -p .../linkedin-extension.zip manifest.json`).
- Confermo che `catalog.json` punta al nuovo zip e che `whatsappExtensionZip.ts` referenzia la versione corretta.

## 5. Cosa NON tocco

- Edge functions LinkedIn (`from-webapp-li`).
- DAL, query keys, hook auth, AuthProvider (lasciati come da fix precedente).
- Memoria `LinkedIn Single Channel Rule` rispettata: continua a passare solo da `from-webapp-li`.
- Editorial review intatto.
- WhatsApp extension: non viene toccata.

## Dettagli tecnici

- Versione manifest: stringa `"3.9.56-restore"` (Chrome accetta segmenti alfanumerici nelle versioni dev unpacked).
- Zip: rigenerato con `nix run nixpkgs#zip` da `public/linkedin-extension/` come da workflow standard.
- Idempotency key in Strategia C: usa `crypto.subtle.digest('SHA-1', ...)`, fallback a hash deterministico semplice se non disponibile.
- Le strategie B/C/D sono client-only: zero modifiche all'extension oltre al rollback. Questo permette di switchare tra strategie senza reinstallare l'extension ogni volta.

## Output finale per l'utente

1. Reinstallare l'extension (zip 3.9.56-restore) — istruzioni a video nel pannello.
2. Aprire `/v2/settings` (o dovunque viva `LinkedInTest.tsx`), selezionare la strategia, fare un invio di prova al destinatario fisso, leggere i log diagnostici già presenti.