

## Diagnosi: Deep Search NON è intelligente

### Problema riscontrato
Il runner `useDeepSearchRunner.ts` invia **tutti** i partner selezionati alla edge function `deep-search-partner` senza alcun controllo. La edge function a sua volta non verifica se `enrichment_data.deep_search_at` è già presente.

**Thailandia**: 178/178 partner hanno già la deep search completata. Se stai eseguendo la deep search su TH in questo momento, stai ripetendo il 100% delle operazioni.

### Soluzione
Aggiungere un filtro intelligente nel runner prima di inviare i partner alla edge function.

**File: `src/hooks/useDeepSearchRunner.ts`**
- Prima del loop, query il database per verificare quali partner hanno già `enrichment_data->>'deep_search_at' IS NOT NULL`
- Filtrare la lista `partnerIds` rimuovendo quelli già arricchiti
- Mostrare un toast informativo: "X partner già arricchiti, Y da processare"
- Se tutti sono già arricchiti, mostrare "Tutti i partner selezionati hanno già la Deep Search" e non avviare il processo
- Aggiungere un parametro opzionale `force?: boolean` per forzare il re-processing quando esplicitamente richiesto

### Dettagli tecnici

```text
partnerIds (input)
    │
    ▼
Query DB: SELECT id FROM partners 
  WHERE id IN (...) 
  AND enrichment_data->>'deep_search_at' IS NOT NULL
    │
    ▼
toProcess = partnerIds - alreadyDone
    │
    ├── toProcess.length === 0 → toast.info("Tutti già arricchiti") → return
    └── toProcess.length > 0  → toast.info("X già fatti, Y da processare") → loop normale
```

| File | Modifica |
|------|----------|
| `src/hooks/useDeepSearchRunner.ts` | Aggiungere filtro pre-loop con query DB + parametro `force` |

Una modifica singola, nessun file nuovo, retrocompatibile.

