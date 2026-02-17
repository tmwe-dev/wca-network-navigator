
# Piano: Riscrittura completa del sistema di download

## Cosa cambia

Il processore attuale (`useDownloadProcessor.ts`) e un mostro di 790 righe con loop di polling, mutex, singleton globali, auto-restart, e logica anti-duplicazione stratificata. Tutto questo viene **deprecato** e sostituito con un sistema minimale che esegue **una sola richiesta alla volta**, guidato dal checkpoint (SpeedGauge).

## Principio del nuovo sistema

```text
[Utente clicca AVVIA] --> Processa profilo #1 --> markRequestSent()
       ^                                              |
       |                                              v
       +------ waitForGreenLight() <----- SpeedGauge dice "VIA"
       |
       v
Processa profilo #2 --> markRequestSent() --> ...ripeti fino a fine lista
```

Nessun loop di polling. Nessun mutex. Nessun singleton su window. Il processore e un semplice ciclo `for` che:
1. Aspetta il semaforo verde (checkpoint 15s)
2. Fa UNA richiesta
3. Segna il timestamp
4. Torna al punto 1

## File deprecati (rinominati con suffisso `.old`)

| File attuale | Nuovo nome |
|---|---|
| `src/hooks/useDownloadProcessor.ts` | `src/hooks/useDownloadProcessor.old.ts` |
| `src/hooks/useScrapingSettings.ts` | `src/hooks/useScrapingSettings.old.ts` |
| `src/components/settings/ScrapingSettings.tsx` | `src/components/settings/ScrapingSettings.old.tsx` |

## Nuovo file: `src/hooks/useDownloadProcessor.ts`

~150 righe totali. Struttura:

```text
useDownloadProcessor()
  |-- processJob(job)          // ciclo for semplice
  |-- emergencyStop()          // flag abort
  |-- appendLog(jobId, ...)    // log terminale (identico a prima)
  |-- verifySessionBeforeJob() // verifica sessione WCA (riusato da prima)
```

Logica del ciclo `processJob`:

```typescript
for (let i = startIndex; i < wcaIds.length; i++) {
  if (abortSignal.aborted) break;

  // 1. Aspetta semaforo verde
  const ok = await waitForGreenLight(abortSignal);
  if (!ok) break;

  // 2. Estrai contatti (con timeout 4s)
  const result = await Promise.race([
    extractContacts(wcaId),
    timeout4s
  ]);

  // 3. Segna richiesta fatta
  markRequestSent();

  // 4. Salva risultato nel DB (stessa logica di prima)
  // 5. Aggiorna progresso job
}
```

Differenze chiave rispetto al vecchio:
- **Nessun polling loop** -- il processore viene chiamato una volta e gira fino a fine job
- **Nessun singleton su window** -- usa un semplice AbortController come ref
- **Nessun mutex** -- un solo job alla volta, nessuna concorrenza possibile
- **Nessun auto-restart** -- se il job finisce o viene fermato, l'utente deve riavviarlo manualmente
- **Nessun keep-alive interval** -- non serve, il job aggiorna il DB ad ogni profilo

## Modifiche ai file esistenti

### `src/pages/Operations.tsx`
- Import cambia da vecchio a nuovo `useDownloadProcessor` (stesso nome, diverso contenuto)
- Nessun cambio nella UI

### `src/pages/Settings.tsx`
- Rimuovere il tab "Scraping" (`ScrapingSettingsPanel`)
- Le credenziali WCA restano nella tab WCA (gia presenti in `WcaSessionCard`)

### `src/components/download/ActionPanel.tsx`
- Rimuovere import di `useScrapingSettings` e `SCRAPING_KEY_MAP`
- Rimuovere toggle "Pausa anti-rilevamento"
- Il delay slider usa un valore locale fisso (default 15s), non piu da settings DB
- Rimuovere import `useUpdateSetting`

### `src/hooks/useDownloadJobs.ts`
- Resta invariato (gestisce CRUD dei job nel DB)

### `src/lib/wcaCheckpoint.ts`
- Resta invariato (e il cuore del nuovo sistema)

### `src/components/download/SpeedGauge.tsx`
- Resta invariato (visualizza lo stato del checkpoint)

## Cosa viene preservato identicamente

- Tutta la logica di salvataggio contatti/profili nel DB (deduplica, merge, network, certificazioni)
- La verifica sessione WCA + auto-login
- Il terminal log
- Il checkpoint gate (`waitForGreenLight` + `markRequestSent`)
- Il timeout 4s per profili che non rispondono
- La politica Zero Retry

## Cosa viene eliminato

- Loop di polling con emptyRounds e auto-shutdown
- Singleton globale `window.__dlProcessorState__`
- Mutex `processing` flag
- AbortableDelay utility
- Random pause anti-detection (il checkpoint 15s e gia sufficiente)
- Keep-alive interval
- Auto-restart loop con setInterval 10s
- `resetStop` function
- Settings scraping nel DB (baseDelay, variation, keepAliveMs, excludeThreshold, maxRetries, randomPause)
- Pannello impostazioni Scraping in Settings

## Dettagli tecnici

Il nuovo processore espone:

```typescript
export function useDownloadProcessor() {
  return {
    startJob: (jobId: string) => void,  // avvia elaborazione di un job specifico
    emergencyStop: () => void,           // ferma tutto
    isProcessing: boolean,               // stato corrente
  };
}
```

`startJob` viene chiamato:
1. Da `ActionPanel` quando crea un nuovo job
2. Da `JobMonitor` quando l'utente clicca "Riprendi"

Non c'e piu bisogno del loop che cerca job pending nel DB -- il processore viene attivato esplicitamente dalla UI.
