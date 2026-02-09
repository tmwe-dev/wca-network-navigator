
# Fix: Permettere di Rientrare nella Vista Job Attivi

## Problema
Quando l'utente esce dalla pagina di download management e torna, vede il banner "X job attivi in background" nella schermata iniziale, ma non puo cliccarci sopra per entrare nella vista dettagliata dei job. L'unico modo per vedere i job attivi e navigare attraverso tutto il wizard (Scarica Partner > selezione paese > ecc.), il che non ha senso.

## Soluzione
Rendere il banner dei job attivi **cliccabile** e aggiungere un **pulsante esplicito** per entrare direttamente nella vista `DownloadRunning` senza passare dal wizard.

## Modifiche

### File: `src/pages/DownloadManagement.tsx`

**1. Banner job attivi nella `StepChoose` (linee 218-235)**

Aggiungere un `onClick` al banner che imposta `step = "running"` e `action = "download"`:
- Trasformare il `div` del banner in un elemento cliccabile con cursore pointer
- Aggiungere un pulsante "Visualizza dettagli" o una freccia a destra per indicare che e cliccabile
- Al click, chiamare `onSelect("download")` con un flag speciale oppure esporre direttamente la navigazione verso running

**2. Esporre la navigazione diretta nel componente principale (linee 144-193)**

Aggiungere una funzione `goToRunning` nel componente `DownloadManagement` che setta simultaneamente `step = "running"` e `action = "download"`, e passarla a `StepChoose`:
```
const goToRunning = () => { setAction("download"); setStep("running"); };
```

Passare questa funzione come prop a `StepChoose`:
```
<StepChoose onSelect={...} onGoToJobs={goToRunning} />
```

**3. Aggiungere le metriche tempo medio (dal piano precedente approvato)**

Nella `JobCard`, aggiungere sotto la progress bar:
- **Tempo medio per profilo**: calcolato come `(updated_at - created_at) / current_index`
- **Tempo netto di scraping**: tempo medio meno il delay configurato
- **Tempo rimanente stimato**: tempo medio moltiplicato per i profili restanti
- **Velocita**: profili al minuto

Questi dati si aggiornano in tempo reale grazie alla subscription Realtime gia attiva.
