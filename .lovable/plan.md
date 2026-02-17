

# Piano: Clessidra visuale + Fix download non funzionante

## Due problemi identificati

### Problema 1: Log GATE troppo verbosi nel terminale
Ogni secondo il checkpoint scrive una riga `GATE: ⏳ Checkpoint: Xs alla zona verde` nel terminale del job. L'utente vuole invece una clessidra animata visuale sopra il cruscotto SpeedGauge, senza righe di testo nel terminale.

### Problema 2: Download non funziona
Il `verifySessionBeforeJob` nel processor (righe 87-123) fa un `postMessage("verifySession")` "grezzo" senza auto-login. Se la verifica fallisce, mette il job in pausa con "Sessione WCA non attiva" anche se l'utente e effettivamente loggato. Questo check e DUPLICATO rispetto all'`ensureSession()` che ActionPanel chiama prima di creare il job, ma il processor non usa la stessa logica con auto-login.

## Modifiche tecniche

### 1. `src/hooks/useDownloadProcessor.ts` -- Fix session + rimozione log GATE

**Fix session**: Sostituire `verifySessionBeforeJob` (righe 87-123) con una versione che usa la stessa logica di `useWcaSession.ensureSession()`:
- Verificare via estensione con `verifySession`
- Se fallisce, tentare auto-login con credenziali dal DB
- Se anche il login fallisce, ALLORA mettere in pausa

**Rimozione log GATE**: Nella chiamata `waitForGreenLight` (riga 275-278), rimuovere il callback `onWaiting` che scrive i log GATE nel terminale. Il countdown sara visivo, non testuale.

### 2. `src/components/download/SpeedGauge.tsx` -- Aggiunta clessidra animata

Aggiungere sopra il cruscotto semicircolare una clessidra animata (icona `Hourglass` di lucide-react) che:
- Si mostra SOLO quando elapsed < 15s (zona non verde)
- Ruota/pulsa come animazione CSS
- Mostra il countdown numerico accanto (es. "8s")
- Quando elapsed >= 15s, la clessidra scompare e appare un segno di spunta verde con "VIA" per 2 secondi
- Nessun testo verbose, solo icona + numero

Layout: la clessidra sta SOPRA il gauge semicircolare, centrata.

### 3. `src/components/download/JobTerminalViewer.tsx` -- Filtrare tipo GATE

Aggiungere "GATE" alla lista dei tipi da NON visualizzare nel terminale (oppure non servira piu dato che non scriviamo piu log GATE). Come sicurezza, il tipo GATE viene filtrato dalla visualizzazione.

## Risultato

- Nessuna riga GATE nel terminale: solo i log utili (START, OK, WARN, DONE)
- Clessidra animata sopra il cruscotto mostra il countdown visivamente
- Il download funziona di nuovo: session check con auto-login integrato nel processor
- L'utente vede solo la clessidra che gira e poi il cruscotto che parte

