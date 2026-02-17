
# Piano: Fix terminale scroll + Job attivo in evidenza + Pausa casuale anti-detection

## 3 interventi richiesti

### 1. Fix scroll del DownloadTerminal

**Problema**: Il terminale non scorre verso il basso automaticamente per mostrare le ultime righe. L'auto-scroll non funziona correttamente perche il `useEffect` dipende da `entries` (array reference che non cambia stabilmente) e l'altezza fissa `h-[220px]` puo risultare limitata nel contesto.

**Soluzione** in `src/components/download/DownloadTerminal.tsx`:
- Cambiare la dipendenza dell'auto-scroll da `entries` a `entries.length` per garantire il trigger ad ogni nuovo log
- Aumentare l'altezza a `h-[280px]` per dare piu spazio
- Aggiungere `flex flex-col` al container e `flex-1` all'area log per adattarsi allo spazio disponibile
- Usare `scrollIntoView` su un div sentinella alla fine della lista (piu affidabile di `scrollTop`)

### 2. Job attivo ben evidenziato in alto

**Problema**: La barra `ActiveJobBar` non mostra chiaramente la percentuale del job attivo. E troppo compatta e difficile da leggere.

**Soluzione** in `src/components/download/ActiveJobBar.tsx`:
- Aggiungere un valore percentuale grande e visibile (es. `42%`) accanto al nome del paese
- Rendere la progress bar piu alta (da `h-1.5` a `h-2.5`) e con la percentuale scritta accanto
- Mostrare stato ("Scaricando... 42%") in modo chiaro con testo piu grande
- Se non ci sono job attivi, il componente resta nascosto (gia cosi)

### 3. Toggle "Pausa occasionale" + logica anti-detection

**Problema**: Il timing dei download e troppo regolare e prevedibile. Il server potrebbe riconoscere il pattern come automatizzato.

**Soluzione**:

**A) Nuovo setting in `src/hooks/useScrapingSettings.ts`**:
- Aggiungere `randomPause: boolean` (default `true`) con chiave `scraping_random_pause`
- Quando attivo, ogni 3-8 profili (random) il sistema inserisce una pausa extra di 5-15 secondi (random)

**B) Toggle nel pannello download `src/components/download/ActionPanel.tsx`**:
- Aggiungere in alto un toggle Switch con label "Pausa anti-rilevamento" che salva il setting `scraping_random_pause` nel DB via `useUpdateSetting`

**C) Logica nel processor `src/hooks/useDownloadProcessor.ts`**:
- Dopo il checkpoint gate (riga 324), se `randomPause` e attivo: generare un contatore casuale (ogni 3-8 profili) e quando scatta, aggiungere un delay extra di 5-15 secondi
- Scrivere un log `INFO` nel terminale: "Pausa anti-rilevamento (Xs)"
- Il contatore si resetta dopo ogni pausa

## Dettagli tecnici

### File modificati

1. **`src/components/download/DownloadTerminal.tsx`** -- Fix auto-scroll + altezza
2. **`src/components/download/ActiveJobBar.tsx`** -- Percentuale grande visibile
3. **`src/hooks/useScrapingSettings.ts`** -- Nuovo campo `randomPause`
4. **`src/components/download/ActionPanel.tsx`** -- Toggle pausa anti-rilevamento
5. **`src/hooks/useDownloadProcessor.ts`** -- Logica pausa casuale nel loop di estrazione

### Logica pausa casuale (pseudo-codice)

```text
nextPauseAt = random(3, 8)  // dopo quanti profili fare pausa
profileCounter = 0

per ogni profilo:
  profileCounter++
  if randomPause attivo AND profileCounter >= nextPauseAt:
    extraDelay = random(5, 15) secondi
    log "INFO: Pausa anti-rilevamento (Xs)"
    attendi extraDelay secondi
    profileCounter = 0
    nextPauseAt = random(3, 8)
```
