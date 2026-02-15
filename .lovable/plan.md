

# Fix definitivo: eliminazione race condition nel polling loop

## Problema identificato

Il bug e' nel blocco `finally` del polling loop. La sequenza e':

```text
1. processJob() completa (o e' in corso)
2. finally: processingRef = false    <-- MUTEX RILASCIATO
3. finally: await 30s cooldown       <-- 30 secondi di attesa
                ^
                |-- durante questi 30s, il setInterval ogni 5s chiama checkJobs()
                |-- processingRef e' false --> entra!
                |-- trova lo stesso job "running" nel DB
                |-- chiama processJob() di NUOVO --> DUPLICATO!
```

Il mutex viene rilasciato PRIMA del cooldown, creando una finestra di 30 secondi in cui il polling puo' rientrare e lanciare una seconda (o terza) istanza di processJob sullo stesso job.

## Soluzione

Spostare il cooldown PRIMA del rilascio del mutex, oppure (piu' pulito) tenere il mutex durante il cooldown. Il `processingRef.current = false` deve essere l'ULTIMA istruzione del `finally`.

### Modifica a `src/hooks/useDownloadProcessor.ts`

Ristrutturare il `finally` block cosi':

```typescript
} finally {
  // Cooldown PRIMA di rilasciare il mutex
  if (didProcess && !stoppedRef.current && !cancelRef.current) {
    await new Promise(r => setTimeout(r, 30000));
  }
  // Rilascia il mutex DOPO il cooldown
  processingRef.current = false;
}
```

### Perche' funziona

- Il mutex resta `true` per tutta la durata del cooldown
- Ogni tick del `setInterval` durante il cooldown vede `processingRef === true` e fa `return` immediatamente
- Zero finestre di race condition
- Nessuna possibilita' di esecuzioni concorrenti

### File modificato

**`src/hooks/useDownloadProcessor.ts`** -- Solo il blocco `finally` (righe 403-409): invertire l'ordine tra cooldown e rilascio del mutex.

