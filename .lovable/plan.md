
# Refactoring completo: polling loop a singolo thread

## Problema strutturale

Il polling attuale usa `setInterval(checkJobs, 5000)` + `checkJobs()` immediato al mount. Questo crea DUE entry point concorrenti. In piu':

- `emergencyStop` imposta `processingRef.current = false` mentre `processJob` potrebbe essere ancora in esecuzione
- Se `queryClient` cambia, l'effetto si smonta e rimonta, creando un NUOVO intervallo mentre il vecchio `processJob` potrebbe essere ancora attivo
- `setInterval` non aspetta che la callback precedente finisca: se `checkJobs` impiega piu' di 5 secondi (e lo fa sempre, con le query DB), i tick si sovrappongono

Nessuna combinazione di flag/mutex puo' risolvere questo in modo affidabile con `setInterval`.

## Soluzione: loop ricorsivo con `setTimeout`

Sostituire l'intero meccanismo `setInterval` + mutex con un singolo loop `while(true)` che:
1. Controlla se ci sono job
2. Se si, processa UN job
3. Aspetta il cooldown
4. Ricomincia dal punto 1

Un solo thread. Un solo flusso. Zero race condition.

## Implementazione

### File: `src/hooks/useDownloadProcessor.ts`

Riscrivere il blocco del polling loop (righe 369-419) cosi':

```typescript
useEffect(() => {
  let alive = true;

  const loop = async () => {
    while (alive && !stoppedRef.current) {
      try {
        const { data: jobs } = await supabase
          .from("download_jobs")
          .select("*")
          .in("status", ["pending", "running"])
          .eq("job_type", "download")
          .order("created_at", { ascending: true })
          .limit(1);

        if (jobs && jobs.length > 0 && alive && !stoppedRef.current) {
          const { data: fresh } = await supabase
            .from("download_jobs")
            .select("status")
            .eq("id", jobs[0].id)
            .single();

          if (fresh && fresh.status !== "cancelled" && fresh.status !== "completed") {
            cancelRef.current = false;
            await processJob(jobs[0]);

            // Cooldown inter-job (30s) -- solo se non e' stato fermato
            if (alive && !stoppedRef.current && !cancelRef.current) {
              await new Promise(r => setTimeout(r, 30000));
            }
            continue; // Ricomincia subito a cercare il prossimo job
          }
        }
      } catch (err) {
        console.error("[DownloadProcessor] Error:", err);
      }

      // Nessun job trovato o errore: aspetta 5s e riprova
      if (alive && !stoppedRef.current) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  };

  loop();
  return () => { alive = false; cancelRef.current = true; };
}, [processJob]);
```

### Cosa cambia

1. **Eliminato `setInterval`** -- nessun timer concorrente, un solo flusso `while`
2. **Eliminato `processingRef`** -- non serve piu' un mutex, il loop e' intrinsecamente sequenziale
3. **`alive` flag** -- booleano locale catturato dalla closure, azzerato nel cleanup. Impossibile da corrompere dall'esterno
4. **`emergencyStop`** -- imposta solo `stoppedRef = true` e `cancelRef = true`. Non tocca piu' `processingRef` (che non esiste piu')
5. **Un solo punto di ingresso** -- `loop()` chiamato una volta, mai duplicato

### Aggiornamento `emergencyStop` e `resetStop`

```typescript
const emergencyStop = useCallback(() => {
  cancelRef.current = true;
  stoppedRef.current = true;
}, []);

const resetStop = useCallback(() => {
  stoppedRef.current = false;
  cancelRef.current = false;
}, []);

return { emergencyStop, resetStop };
```

- Rimosso `processingRef.current = false` da `emergencyStop` (non esiste piu')
- Rimosso `isProcessing` dal return (era comunque sempre `false` perche' i ref non causano re-render)

### Riepilogo modifiche

Un solo file modificato: `src/hooks/useDownloadProcessor.ts`
- Eliminata la variabile `processingRef`
- Riscritto il `useEffect` del polling (righe 369-419) con un `while` loop
- Semplificato `emergencyStop` (2 righe)
- Semplificato il return (senza `isProcessing`)
- `processJob` e tutta la logica di estrazione contatti restano IDENTICI
