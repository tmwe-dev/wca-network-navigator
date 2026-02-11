

# Fix: Ripristino automatico del monitoraggio acquisizione al rientro nella pagina

## Problema

Quando navighi fuori dalla pagina Acquisizione e ci ritorni, il job in background continua a processare (la Edge Function lavora indipendentemente), ma la UI non lo mostra. Il motivo:

- Il `useEffect` di mount trova il job attivo e ricostruisce la coda
- Ma imposta lo stato a "idle" o "paused", mai a "running"
- Il loop di polling che aggiorna la UI in tempo reale (barra progresso, canvas, statistiche) viene avviato solo quando clicchi "Avvia Acquisizione"
- Risultato: vedi la lista dei partner ma nessun feedback live

## Soluzione

### File: `src/pages/AcquisizionePartner.tsx`

1. **Auto-resume del polling quando il job e' "running"**: nel `useEffect` di mount (riga 72-195), se il job trovato ha `status === "running"`, impostare `pipelineStatus` a `"running"` e avviare automaticamente il polling loop per seguire il progresso in tempo reale.

2. **Estrarre il polling loop in una funzione riusabile**: attualmente il loop di polling (righe 394-705) e' embedded dentro `startPipeline`. Verra' estratto in una funzione `pollJobProgress(jobId, items)` che puo' essere chiamata sia da `startPipeline` che dal `useEffect` di resume.

3. **Aggiornare le live stats dal DB al mount**: quando si riprende un job, caricare `contacts_found_count`, `contacts_missing_count` e `current_index` dal job per popolare subito le statistiche live, senza aspettare il primo ciclo di polling.

### Dettaglio tecnico

```text
PRIMA (attuale):
  Mount -> trova job "running" -> pipelineStatus = "idle" -> UI ferma

DOPO (fix):
  Mount -> trova job "running" -> pipelineStatus = "running"
        -> avvia pollJobProgress() -> UI mostra progresso live
        -> aggiorna coda, stats, canvas in tempo reale
```

### Modifiche specifiche

- Riga 182: cambiare da `setPipelineStatus(job.status === "paused" ? "paused" : "idle")` a gestire anche il caso `"running"` avviando il polling
- Aggiungere al mount l'inizializzazione delle `liveStats` con i dati gia' presenti nel job (`contacts_found_count`, `contacts_missing_count`)
- Utilizzare un `useRef` per il polling in modo che possa essere pulito se l'utente naviga via di nuovo

## File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Auto-resume polling al mount quando job e' running + init live stats dal DB |

## Risultato atteso

- Quando torni alla pagina Acquisizione e c'e' un job attivo, lo vedi subito con barra progresso, statistiche e canvas animato — identico a come se non avessi mai lasciato la pagina
- I bottoni Pausa/Stop sono immediatamente disponibili

