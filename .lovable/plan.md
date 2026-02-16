
# Fix: Processi Fantasma e Chiamate Duplicate

## Problemi Identificati

### 1. DUE chiamate identiche a `get_directory_counts`
Il problema delle "due chiamate con lo stesso nome" e reale e documentato: la stessa RPC `get_directory_counts` viene chiamata da DUE posti diversi nello stesso momento:
- **Operations.tsx** (riga 28): hook `useDirectoryTotal()` con query key `["ops-directory-total"]`
- **CountryGrid.tsx** (riga 44): query con key `["cache-data-by-country"]`

Poiche hanno query key diverse, React Query le tratta come query separate e spara DUE richieste identiche al database simultaneamente.

### 2. Job cancellato rimasto nel database
Il job Albania (`e6d4b363...`) con status `cancelled` e ancora nel DB. Non e stato eliminato dalla pulizia precedente.

### 3. Il loop di polling non si ferma MAI
Il processore di download esegue un loop infinito che interroga il database ogni 15 secondi cercando job `pending`, anche quando non ce ne sono. Questo genera traffico inutile e confonde l'utente che vede "processi attivi" nel network inspector.

### 4. Il mount guard e insufficiente
Il guard alla riga 609 controlla `state.processing`, ma durante la pausa di 15 secondi `processing` e `false`. Di conseguenza, su ogni HMR o remount del componente, il guard passa e crea un SECONDO loop. Il vecchio loop esce alla prossima iterazione (controlla `loopId`), ma nel frattempo i due loop si sovrappongono brevemente, causando query duplicate.

---

## Piano di Intervento

### A. Eliminare la chiamata duplicata a `get_directory_counts`
**File**: `src/pages/Operations.tsx`

Rimuovere completamente l'hook `useDirectoryTotal()` e il suo utilizzo. I dati di directory totale (paesi scansionati e totale membri) verranno calcolati dalla stessa query `cache-data-by-country` che usa gia CountryGrid.tsx, passandoli come prop o leggendo dalla stessa query key di React Query.

In pratica:
- Eliminare la funzione `useDirectoryTotal()` (righe 24-37)
- Recuperare `scannedCountries` e `totalDirectory` dalla query `["cache-data-by-country"]` che gia esiste in CountryGrid
- Usare `useQuery` con la stessa key `["cache-data-by-country"]` in Operations.tsx per leggere i dati gia in cache (zero chiamate extra)

### B. Aggiungere un flag `loopRunning` al singleton
**File**: `src/hooks/useDownloadProcessor.ts`

Aggiungere un campo `loopRunning: boolean` allo stato globale, separato da `processing`. Questo flag e `true` per tutta la durata del loop (incluse le pause di 15s) e `false` solo quando il loop esce davvero.

Il mount guard usera `loopRunning` invece di `processing`:

```text
interface DlProcessorState {
  cancel: boolean;
  stopped: boolean;
  activeLoopId: number;
  processing: boolean;
  loopRunning: boolean;  // NUOVO: true finche il loop esiste
  abortController: AbortController | null;
}
```

Il guard diventa:
```text
if (state.loopRunning && !state.stopped && !state.cancel) {
  return; // Loop gia attivo, non crearne un altro
}
```

E nel corpo del loop:
```text
state.loopRunning = true;
// ... while loop ...
state.loopRunning = false; // Solo quando il while esce
```

### C. Pulizia del job cancellato
Eliminare il job Albania cancellato rimasto nel database.

### D. (Opzionale) Ridurre polling quando non ci sono job
Quando il loop non trova job pending per 3 cicli consecutivi, aumentare l'intervallo di polling da 15s a 60s. Tornare a 15s appena arriva un nuovo job (tramite realtime notification da useDownloadJobs).

---

## Dettagli Tecnici

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/Operations.tsx` | Rimuovere `useDirectoryTotal()`, usare `["cache-data-by-country"]` condiviso |
| `src/hooks/useDownloadProcessor.ts` | Aggiungere `loopRunning` al singleton, fix mount guard |
| Database | Eliminare job Albania cancellato |

### Risultato atteso
- UNA sola chiamata a `get_directory_counts` invece di due
- Nessun loop duplicato su remount/HMR
- Nessun job fantasma nel database
- Il processore continua a funzionare correttamente per i job reali
