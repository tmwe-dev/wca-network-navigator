

# Fix: Slider Delay nel JobCard

## Problema
Il cursore della velocita (delay) nel pannello di un job attivo ha due bug:

1. **Nessun debounce**: `handleSpeedChange` chiama `updateSpeed.mutate()` ad ogni micro-movimento del cursore, inviando decine di richieste al database in un secondo
2. **Nessuna invalidazione cache**: `useUpdateJobSpeed` non invalida la query `download-jobs`, quindi quando arriva il prossimo aggiornamento realtime, il valore del cursore torna indietro alla posizione precedente (effetto "snap-back")

## Soluzione

### File: `src/hooks/useDownloadJobs.ts`
- Aggiungere `queryClient` e `onSuccess` con invalidazione della query `download-jobs` in `useUpdateJobSpeed`

### File: `src/pages/DownloadManagement.tsx` (componente `JobCard`)
- Aggiungere uno stato locale `localDelayIdx` per tracciare la posizione del cursore durante il drag
- Usare `onValueCommit` invece di `onValueChange` per inviare la mutazione solo quando l'utente rilascia il cursore (il componente Radix Slider supporta nativamente `onValueCommit`)
- Usare `onValueChange` solo per aggiornare lo stato locale visivo
- Questo elimina completamente il flooding di richieste e il problema dello snap-back

### Dettaglio tecnico

Nel `JobCard`, il codice attuale:
```
<Slider value={[delayIdx]} onValueChange={([v]) => handleSpeedChange(v)} />
```

Diventa:
```
const [localDelayIdx, setLocalDelayIdx] = useState(delayIdx);

// Sync when job data updates from realtime
useEffect(() => setLocalDelayIdx(delayIdx), [delayIdx]);

<Slider 
  value={[localDelayIdx]} 
  onValueChange={([v]) => setLocalDelayIdx(v)}        // solo visivo
  onValueCommit={([v]) => handleSpeedChange(v)}        // salva al rilascio
/>
```

In `useUpdateJobSpeed`, aggiungere invalidazione:
```
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
}
```

Nessuna modifica al database o alle edge function.

