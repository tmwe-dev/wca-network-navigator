
# Fix: Download processor si blocca dopo 2 profili

## Diagnosi

Il processore di download ha un bug nel loop di polling che impedisce la ripresa dei job.

### Flusso del bug

1. Il job processa alcuni profili
2. L'estensione Chrome diventa momentaneamente non disponibile (o un qualsiasi break nel loop interno)
3. La fix precedente imposta `cancelRef.current = true` (riga 126) per evitare che il job venga marcato come "completed"
4. Il job viene messo in pausa nel DB -- fin qui tutto corretto
5. L'utente clicca "Riavvia" nel JobMonitor --> il DB viene aggiornato a status="running"
6. Ma il loop di polling (riga 373) controlla `cancelRef.current` come guardia di ingresso:
   ```
   if (stoppedRef.current || cancelRef.current || processingRef.current) return;
   ```
7. `cancelRef` e' ancora `true` --> il polling salta OGNI tick --> il job non viene mai ripreso
8. Il processore e' effettivamente morto

### Problema secondario

Il pulsante "Riavvia" in JobMonitor chiama solo `pauseResume.mutate({ action: "resume" })` che aggiorna il DB, ma **non** chiama `resetStop()` del processore per pulire i flag interni.

## Soluzione

### 1. Rimuovere `cancelRef` dalla guardia del polling (`useDownloadProcessor.ts`, riga 373)

`cancelRef` serve solo come segnale interno per interrompere il loop di `processJob`. Non deve bloccare il polling esterno. La riga 396 lo resetta gia' a `false` prima di ogni nuova esecuzione di `processJob`.

Cambiare da:
```typescript
if (stoppedRef.current || cancelRef.current || processingRef.current) return;
```
A:
```typescript
if (stoppedRef.current || processingRef.current) return;
```

Questo garantisce che:
- `stoppedRef` blocca dopo emergency stop (richiede reset manuale)
- `processingRef` blocca esecuzioni concorrenti
- `cancelRef` resta un segnale interno per il loop di processJob, resettato automaticamente a ogni nuovo job (riga 396)

### File modificato

**`src/hooks/useDownloadProcessor.ts`** -- Una sola riga: rimuovere `cancelRef.current` dalla condizione di guardia del polling loop.
