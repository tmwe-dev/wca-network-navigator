

## Piano: Notifiche proattive per job in pausa e feedback di progresso

### Problema
Quando si avvia un download (es. Ungheria), il job viene creato ma se la sessione WCA non e' verificabile (estensione non disponibile, timeout, login fallito), il job passa silenziosamente a "paused" senza alcuna notifica all'utente. Il `useJobHealthMonitor` rileva solo stati `failed`, `running` (stalled) e `completed`, ma ignora completamente `paused`. L'utente vede "Download Ungheria" nell'header ma nessun progresso e nessuna spiegazione.

### Causa tecnica
1. `useDownloadProcessor.startJob()` chiama `verifyWcaSession()` — se fallisce, setta `status: "paused"` con un `error_message` ma non emette toast
2. `useJobHealthMonitor` non gestisce lo stato `paused`
3. L'`ActiveProcessIndicator` mostra il job come "in coda" ma non comunica il motivo del blocco

### Soluzione

**File 1: `src/hooks/useJobHealthMonitor.ts`**
- Aggiungere rilevamento dei job `paused` — quando un job transita a `paused`, mostrare un toast con il `error_message` (es. "Sessione WCA non attiva", "Rate-limit attivo")
- Il toast indica chiaramente all'utente cosa fare (verificare sessione/estensione)

**File 2: `src/components/layout/ActiveProcessIndicator.tsx`**
- Nella `ProcessRow`, quando il job e' `paused` e ha un `error_message`, mostrare il messaggio di errore sotto la barra di progresso in rosso/ambra
- Questo richiede che `ActiveProcess` porti anche il campo `errorMessage`

**File 3: `src/hooks/useActiveProcesses.ts`**
- Estendere l'interfaccia `ActiveProcess` con campo opzionale `errorMessage?: string`
- Passare `job.error_message` nel mapping dei download jobs

### Dettaglio tecnico

```typescript
// useJobHealthMonitor.ts — aggiungere dopo il blocco "completed"
if (job.status === "paused" && !notifiedRef.current.has(`pause-${job.id}`)) {
  notifiedRef.current.add(`pause-${job.id}`);
  toast({
    title: `⏸️ Download ${job.country_name} in pausa`,
    description: job.error_message || "Verifica la sessione WCA e riprendi.",
    variant: "destructive",
  });
}
```

```typescript
// useActiveProcesses.ts — nel mapping download jobs
errorMessage: job.error_message || undefined,
```

```typescript
// ActiveProcessIndicator.tsx — nella ProcessRow, sotto la progress bar
{process.errorMessage && isPaused && (
  <p className="text-[10px] text-amber-500 mt-0.5 truncate">{process.errorMessage}</p>
)}
```

### File da modificare
1. `src/hooks/useJobHealthMonitor.ts` — aggiungere notifica paused
2. `src/hooks/useActiveProcesses.ts` — estendere interfaccia + passare errorMessage
3. `src/components/layout/ActiveProcessIndicator.tsx` — mostrare errorMessage nella ProcessRow

