

# Refactoring del polling loop in useDownloadProcessor

## Problema confermato dai log

I log del terminale mostrano chiaramente ogni profilo processato DUE volte:
```
START #150648 -> OK Fatton -> WAIT -> OK Fatton (duplicato!)
START #119630 -> START #119630 (duplicato!) -> OK Freyer -> WAIT -> OK Freyer (duplicato!)
```

## Causa radice: race condition nel mutex

Il polling loop ha una finestra temporale in cui due chiamate `checkJobs()` possono eseguire contemporaneamente:

```text
Tick 1 (mount):    guard(false) --> await DB query... --> processingRef = true --> processJob()
                                        ^
Tick 2 (5s later): guard(false) --------|--- passa perche' processingRef e' ancora false!
                                            --> await DB query --> processingRef = true --> processJob() (DUPLICATO!)
```

Il problema e' che `processingRef.current = true` viene impostato DOPO le query asincrone al DB (riga 395), non immediatamente dopo il controllo della guardia (riga 373).

## Soluzione: mutex sincrono immediato

### Modifica a `src/hooks/useDownloadProcessor.ts`

Ristrutturare il polling loop cosi':

1. Spostare `processingRef.current = true` IMMEDIATAMENTE dopo la guardia, PRIMA di qualsiasi operazione asincrona
2. Rimuovere il check ridondante di `cancelRef.current` alla riga 393 (e' incoerente con la rimozione dalla riga 373)
3. Semplificare il flusso per eliminare la finestra di race condition

```typescript
// Main polling loop
useEffect(() => {
  const checkJobs = async () => {
    if (stoppedRef.current || processingRef.current) return;

    // MUTEX: blocca IMMEDIATAMENTE, prima di qualsiasi async
    processingRef.current = true;

    try {
      const { data: pendingJobs } = await supabase
        .from("download_jobs")
        .select("*")
        .in("status", ["pending", "running"])
        .eq("job_type", "download")
        .order("created_at", { ascending: true })
        .limit(1);

      if (!pendingJobs || pendingJobs.length === 0) return; // finally rilascera' il mutex

      const { data: freshCheck } = await supabase
        .from("download_jobs")
        .select("status")
        .eq("id", pendingJobs[0].id)
        .single();

      if (!freshCheck || freshCheck.status === "cancelled" || freshCheck.status === "completed") return;
      if (stoppedRef.current) return;

      cancelRef.current = false;
      await processJob(pendingJobs[0]);
    } catch (err) {
      console.error("[DownloadProcessor] Error:", err);
    } finally {
      processingRef.current = false;
      // Cooldown inter-job solo se il job e' finito normalmente
      if (!stoppedRef.current && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  };

  checkJobs();
  const interval = setInterval(checkJobs, 5000);
  return () => {
    clearInterval(interval);
    cancelRef.current = true;
  };
}, [processJob]);
```

### Differenze chiave rispetto al codice attuale

1. `processingRef.current = true` spostato dalla riga 395 (dopo 2 query DB) a subito dopo la guardia (sincrono, zero finestra di race)
2. Il `finally` rilascia sempre il mutex, anche se non ci sono job da processare
3. Rimosso il check `cancelRef.current` dalla riga 393 (incoerente)
4. `cancelRef.current = false` spostato dentro il blocco protetto dal mutex

Nessuna altra modifica al file -- il `processJob`, l'emergency stop e il reset restano invariati.

