

# Riorganizzazione del pannello destro: Job Attivo vs Coda

## Problema attuale

Quando lanci il download per molti paesi, il JobMonitor mostra TUTTI i job (running + pending + paused) nella stessa lista. Con 390 job pending, il pannello diventa illeggibile. Non si capisce cosa sta succedendo adesso e il terminal si perde nel mare di card.

## Nuova struttura del pannello destro (nessun paese selezionato)

Il pannello destro viene diviso in 3 sezioni verticali chiare e fisse:

```text
+------------------------------------------+
|  [1] JOB ATTIVO (running)                |
|  Card grande con progresso, stats,        |
|  ultimo partner, contatti trovati         |
+------------------------------------------+
|  [2] TERMINAL                            |
|  Log in tempo reale del job attivo        |
|  (altezza fissa ~200px)                   |
+------------------------------------------+
|  [3] CODA (collassabile)                 |
|  "198 job in coda" con chevron            |
|  Espandibile: lista compatta dei pending  |
|  + Sezione "Completati recenti" (max 5)   |
+------------------------------------------+
```

## Dettagli tecnici

### File: `src/components/download/JobMonitor.tsx`

Ristrutturare il componente per separare visivamente:

1. **Sezione "Job Attivo"**: mostra SOLO il job con status `running`. Se nessun job e' running, mostra il primo `pending` con label "Prossimo in coda". Card grande con tutti i dettagli (progresso, ETA, contatti, ultimo partner, pulsanti pausa/stop).

2. **Sezione "Coda"**: collassabile con click. Header mostra il conteggio ("198 in coda"). Quando espansa, lista compatta (una riga per job: bandiera, nome paese, progresso X/Y). Niente card elaborate, solo righe minimali.

3. **Sezione "Completati"**: come oggi, max 5, collassabile.

### File: `src/pages/Operations.tsx`

Nessun cambiamento alla struttura del layout (gia' corretto nell'ultimo edit). L'ordine resta: ActiveJobBar, DownloadTerminal, JobMonitor.

### Logica di separazione nel JobMonitor

```text
const runningJob = jobs.find(j => j.status === "running");
const nextPending = !runningJob ? jobs.find(j => j.status === "pending") : null;
const featuredJob = runningJob || nextPending;

const queuedJobs = jobs.filter(j => 
  j.status === "pending" && j.id !== featuredJob?.id
);
const pausedJobs = jobs.filter(j => j.status === "paused");
const recentCompleted = jobs.filter(j => 
  j.status === "completed" || j.status === "cancelled"
).slice(0, 5);
```

- `featuredJob` viene mostrato come card grande (come oggi)
- `queuedJobs` + `pausedJobs` vengono mostrati in una sezione collassabile con righe compatte
- `recentCompleted` resta in fondo, collassabile

### File modificati

1. `src/components/download/JobMonitor.tsx` -- ristrutturazione in 3 sezioni (attivo / coda / completati)

