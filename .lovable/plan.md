

# Piano: Fix ripresa job — due problemi da risolvere

## Problema 1: Stato sbagliato
Il pulsante "Riprendi" chiama `usePauseResumeJob` con action `"resume"`, che imposta lo stato a `"running"`. Ma il loop del processore (riga 649 di `useDownloadProcessor.ts`) cerca SOLO job con stato `"pending"`. Il job rimane in stato `"running"` ma nessuno lo processa.

## Problema 2: Loop spento
Il loop di polling si auto-spegne dopo 3 cicli vuoti (~45 secondi senza job). Quando l'utente clicca "Riprendi" minuti dopo, il loop non e piu attivo.

## Soluzione

### File 1: `src/hooks/useDownloadJobs.ts` — Funzione `usePauseResumeJob`

Cambiare l'azione `"resume"` per impostare lo stato a `"pending"` invece di `"running"`:

```typescript
// Prima:
} else if (action === "resume") {
  await supabase.from("download_jobs").update({ status: "running", error_message: null }).eq("id", jobId);
}

// Dopo:
} else if (action === "resume") {
  await supabase.from("download_jobs").update({ status: "pending", error_message: null }).eq("id", jobId);
}
```

Cosi il loop lo trovera nella sua query normale per job `pending`.

### File 2: `src/hooks/useDownloadProcessor.ts` — Riavvio loop

Dopo il mount iniziale (riga 692-708), aggiungere un listener sulla query `download-jobs` che riavvia il loop se trova job `pending` e il loop e spento:

```typescript
// Nuovo useEffect: riavvia il loop se ci sono job pending e il loop e fermo
useEffect(() => {
  const interval = setInterval(() => {
    const state = getDlState();
    if (!state.loopRunning && !state.stopped) {
      // Check if pending jobs exist
      supabase
        .from("download_jobs")
        .select("id")
        .eq("status", "pending")
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0 && !state.loopRunning) {
            console.log("[DownloadProcessor] Pending job found, restarting loop");
            state.cancel = false;
            const myId = ++state.activeLoopId;
            startLoop(myId);
          }
        });
    }
  }, 10000); // Check every 10s

  return () => clearInterval(interval);
}, [startLoop]);
```

Questo garantisce che quando un job viene rimesso in `pending` tramite "Riprendi", il loop si riattiva entro 10 secondi al massimo.

Nessun altro file da modificare.

