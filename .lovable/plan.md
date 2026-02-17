

# Piano: Fix definitivo del processore di download

## Problema identificato

Il processore ha una race condition critica:

1. `startJob` controlla `isProcessing` (stato React) per evitare esecuzioni concorrenti
2. `setIsProcessing(true)` e asincrono -- non si aggiorna immediatamente
3. L'intervallo di auto-start (ogni 10s) trova lo stesso job `pending` e chiama `startJob` di nuovo
4. La seconda chiamata passa il guard perche `isProcessing` e ancora `false` nel closure
5. La seconda chiamata fallisce l'atomic claim (il job e gia `running`) e fa `setIsProcessing(false)` nel finally
6. Il ciclo si ripete all'infinito: il job resta "running" ma nessuno lo processa realmente

I log confermano: `[Processor] Auto-starting pending job: 287eab81...` appare 3 volte in 4 minuti.

## Soluzione

Sostituire il guard basato su `useState` con un **ref sincrono** (`useRef<boolean>`) che si aggiorna istantaneamente, eliminando la race condition.

### File: `src/hooks/useDownloadProcessor.ts`

Riscrittura completa (~200 righe) con queste correzioni:

```text
PRIMA (rotto):
  const [isProcessing, setIsProcessing] = useState(false);
  // ...
  const startJob = useCallback(async (jobId) => {
    if (isProcessing) return;      // <-- closure stale!
    setIsProcessing(true);          // <-- asincrono!

DOPO (corretto):
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // ...
  const startJob = useCallback(async (jobId) => {
    if (processingRef.current) return;   // <-- sincrono, immediato
    processingRef.current = true;         // <-- sincrono, immediato
    setIsProcessing(true);                // <-- solo per UI
```

Altre correzioni incluse:

1. **Rimuovere `isProcessing` dalle dipendenze di `useCallback`** -- attualmente causa la ricreazione del callback ad ogni cambio di stato, rompendo il pattern ref
2. **Semplificare l'auto-start** -- controllare `processingRef.current` invece di `isProcessingRef.current` (un ref in meno)
3. **Aggiungere log di debug** all'ingresso e uscita di `startJob` per diagnostica futura
4. **Garantire che `processingRef.current = false`** sia sempre eseguito nel `finally`, anche in caso di errore

### Struttura del nuovo processore

Nessun cambio architetturale -- stessa logica, stessi file, stessa interfaccia. Solo il fix del guard:

```text
useDownloadProcessor()
  |
  |-- processingRef (useRef<boolean>)     // NUOVO: guard sincrono
  |-- isProcessing (useState<boolean>)    // solo per UI rendering
  |-- abortRef (useRef<AbortController>)  // invariato
  |
  |-- startJob(jobId)
  |     1. if (processingRef.current) return   // guard sincrono
  |     2. processingRef.current = true
  |     3. setIsProcessing(true)               // aggiorna UI
  |     4. fetch job dal DB
  |     5. verifySession
  |     6. atomic claim (WHERE status = pending)
  |     7. for loop: waitForGreenLight -> extract -> markRequestSent
  |     8. finally: processingRef.current = false; setIsProcessing(false)
  |
  |-- emergencyStop()                     // invariato
  |
  |-- auto-start useEffect (10s interval)
  |     - if (processingRef.current) return   // usa il ref diretto
  |     - query pending jobs
  |     - call startJob
```

### File modificati

Solo **1 file**: `src/hooks/useDownloadProcessor.ts`

Nessun altro file tocco. Il resto (ActionPanel, JobMonitor, Operations, useDownloadJobs, wcaCheckpoint, SpeedGauge) resta identico.

## Dettaglio tecnico delle modifiche

1. Aggiungere `const processingRef = useRef(false)` accanto a `useState`
2. Nel `startJob`: prima riga `if (processingRef.current) return`, seconda riga `processingRef.current = true`
3. Nel `finally`: `processingRef.current = false` prima di `setIsProcessing(false)`
4. Rimuovere `isProcessing` dall'array di dipendenze di `useCallback` (usare `[]` o `[queryClient]`)
5. Rimuovere `isProcessingRef` (ridondante con `processingRef`)
6. Nell'auto-start `useEffect`: sostituire `isProcessingRef.current` con `processingRef.current`

