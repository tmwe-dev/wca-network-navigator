

# Fix: Pulsanti di Controllo Download e Affidabilita del Sistema

## Problemi Identificati

### 1. Il pulsante STOP non ferma immediatamente il processo
Il pulsante STOP nella barra superiore chiama `emergencyStop()` che imposta solo dei flag (`cancel=true`, `stopped=true`). Ma se il processore e nel mezzo di un'estrazione tramite Chrome Extension (che puo durare 5-15 secondi), il flag viene controllato solo DOPO che l'estrazione finisce. Risultato: sembra che il pulsante non funzioni.

### 2. "Elimina tutti" non cancella il job in evidenza
Il pulsante "Elimina tutti" nella sezione Coda cancella solo i job con stato `paused` o `pending`. Ma il job "featured" (mostrato in alto come "Prossimo in coda") e anch'esso `pending` e viene filtrato fuori dalla lista coda. Dopo l'eliminazione, il job featured rimane visibile perche non viene incluso nella cancellazione.

### 3. I pulsanti rimangono visibili dopo l'azione
Dopo aver cliccato "Elimina tutti", la sezione coda resta visibile finche React Query non invalida e ricarica i dati. Serve un aggiornamento piu reattivo.

### 4. Garanzia chiamata singola
L'architettura attuale e solida con 5 livelli di protezione (mutex globale, loop ID, atomic claim SQL, esecuzione sequenziale, keep-alive). Non ci sono falle nella garanzia di singola chiamata.

---

## Piano di Intervento

### A. STOP immediato e reattivo
**File**: `src/hooks/useDownloadProcessor.ts`

- Aggiungere un `AbortController` al singleton globale
- Quando `emergencyStop()` viene chiamato, oltre ai flag, fare abort del controller corrente
- Nel loop di estrazione, controllare il flag `cancel` PRIMA e DOPO ogni operazione asincrona (DB query, extension call, delay)
- Aggiungere check intermedi nel blocco di salvataggio contatti (il piu lungo)
- Dopo emergency stop, aggiornare IMMEDIATAMENTE il job nel DB a "cancelled" dal client (senza aspettare che il loop arrivi al check)

### B. "Elimina tutti" include il job in evidenza
**File**: `src/hooks/useDownloadJobs.ts`

- Modificare `useDeleteQueuedJobs` per eliminare TUTTI i job `pending` e `paused`, senza esclusioni
- Il featured job pending verra eliminato insieme alla coda
- Se c'e un job `running`, NON eliminarlo (solo i pending/paused)

### C. Feedback immediato dopo eliminazione
**File**: `src/components/download/JobMonitor.tsx`

- Dopo la mutazione `deleteQueued`, forzare `queryClient.invalidateQueries` inline
- Disabilitare i pulsanti durante il pending della mutazione (gia fatto parzialmente)
- Aggiungere `onSuccess` callback per aggiornamento immediato

### D. Pulsante STOP: feedback visivo istantaneo
**File**: `src/components/download/SpeedGauge.tsx`

- Dopo il click su STOP, cambiare immediatamente lo stato visivo del pulsante (es. "FERMANDO..." con spinner)
- Disabilitare il pulsante per evitare click multipli

---

## Dettagli Tecnici

### Modifica al singleton (useDownloadProcessor.ts)

```text
interface DlProcessorState {
  cancel: boolean;
  stopped: boolean;
  activeLoopId: number;
  processing: boolean;
  abortController: AbortController | null;  // NUOVO
}
```

La funzione `emergencyStop()` diventa:

```text
const emergencyStop = () => {
  const state = getDlState();
  state.cancel = true;
  state.stopped = true;
  state.abortController?.abort();  // Interrompe delay in corso
  // Aggiorna DB immediatamente
  supabase
    .from("download_jobs")
    .update({ status: "cancelled", error_message: "EMERGENCY STOP" })
    .in("status", ["running", "pending"])
    .then(() => queryClient.invalidateQueries({ queryKey: ["download-jobs"] }));
};
```

I `setTimeout` nel loop verranno sostituiti con una funzione `abortableDelay` che si interrompe subito quando l'AbortController viene abortito.

### Modifica a deleteQueuedJobs (useDownloadJobs.ts)

La mutazione eliminera tutti i job `pending` e `paused` senza distinzioni, incluso quello mostrato come "featured/prossimo".

### Modifica al JobMonitor (JobMonitor.tsx)

Aggiungere `queryClient.invalidateQueries` nel callback `onSuccess` della mutazione `deleteQueued` per garantire che l'UI si aggiorni immediatamente dopo l'eliminazione.

