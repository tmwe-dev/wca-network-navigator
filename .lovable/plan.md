

## Diagnosi: Bug "Fallthrough" — Profili persi silenziosamente

### Il problema esatto

Il codice in `useDownloadProcessor.ts` ha **tre** controlli in sequenza dopo l'estrazione (linee 190-243):

1. `result.pageLoaded === false` → retry queue
2. `isMemberNotFound` (solo se pageLoaded) → skip permanente
3. **Nessun altro controllo** → cade direttamente in `saveExtractionResult`

Quando l'estensione Chrome restituisce un errore di comunicazione (es. "Extension context invalidated", "No response from extension"), il risultato è:

```text
{ success: false, error: "Extension context invalidated" }
```

Questo oggetto **NON ha** il campo `pageLoaded`. Quindi:
- `result.pageLoaded === false` → **FALSE** (è `undefined`, non `false`)
- `isMemberNotFound` → **FALSE** (nessun testo "member not found")
- Il codice **cade attraverso** fino a `saveExtractionResult` (linea 235)

In `profileSaver.ts` linea 21: `if (result.success && ...)` — siccome `success` è `false`, non salva nulla. Ma il profilo viene comunque aggiunto a `processedSet` (linea 292) e marcato come "completato" per sempre.

**B2C Logistics e gli altri profili vengono persi esattamente così**: l'estensione ha un glitch momentaneo, il bridge non risponde, e il sistema li marca come processati con zero dati.

### Fix

**File: `src/hooks/useDownloadProcessor.ts`**

Aggiungere un terzo check dopo il blocco "member not found" (dopo linea 232), sia nel Pass 1 che nel Pass 2:

```typescript
// 3. Extension error (success: false, no pageLoaded) → retry queue
if (result.success === false) {
  await appendLog(jobId, "SKIP", 
    `Profilo #${wcaId} errore estensione: ${result.error || "sconosciuto"} — retry queue`);
  retryQueue.push(wcaId);
  consecutiveSkipped++;
  if (consecutiveSkipped >= 3) {
    // stessa guardia sessione esistente
  }
  // update DB + continue
  continue;
}
```

Nel **Pass 2** (dopo linea 397), lo stesso check ma con `failedIds.push(wcaId)` invece di `retryQueue`.

Nessun'altra modifica necessaria — il resto del flusso è corretto.

