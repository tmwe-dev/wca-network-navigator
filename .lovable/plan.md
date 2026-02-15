
# Rifattorizzazione Completa: Gestione Stop/Start dei Job

## Problemi trovati (analisi riga per riga)

### BUG 1: Loop di polling instabile (`useDownloadProcessor.ts`)
`processJob` dipende da `settings` (riga 355), che cambia ad ogni render. Questo causa la ri-creazione del `useEffect` di polling (riga 358), che nel cleanup imposta `cancelRef = true`, ma subito dopo il nuovo effetto imposta `cancelRef = false` (riga 372). Risultato: un job fermato puo' ripartire da solo.

### BUG 2: Race condition nell'Emergency Stop
Quando premi "BLOCCA TUTTO", `cancelRef = true` e `processingRef = false` vengono impostati lato client, e il DB viene aggiornato a "cancelled". Ma il polling loop gira ogni 5 secondi: se scatta **prima** che l'update del DB sia completato, trova il job ancora "running", imposta `cancelRef = false` e lo riavvia.

### BUG 3: Auto-resume al montaggio del componente
`AcquisizionePartner.tsx` (riga 640) riprende automaticamente qualsiasi job con status "running" quando il componente viene montato. Se navighi via e torni, il job riparte anche se lo avevi appena fermato.

### BUG 4: Dialog "Riprova" viola la politica Zero Retry
Il dialog a fine acquisizione (righe 1259-1278) offre di ritentare i partner senza contatti, generando nuove richieste WCA per gli stessi profili.

---

## Piano di correzione

### 1. Stabilizzare `useDownloadProcessor.ts`

- Spostare `settings` in un `useRef` (settingsRef) aggiornato tramite `useEffect`, cosi' `processJob` non dipende piu' da `settings` e non viene ricreato
- Il polling `useEffect` diventa a montaggio singolo (`[]`), eliminando la ri-creazione dell'intervallo
- Aggiungere un **DB check** nel polling: prima di avviare un job, verificare che non sia stato cancellato nel frattempo (query fresca)
- `emergencyStop` deve anche impostare un flag `stoppedRef = true` che il polling controlla prima di prendere nuovi job

### 2. Proteggere il polling dal restart dopo Stop

Aggiungere nel `checkJobs`:
```
// Se e' stato dato un emergency stop, non prendere nuovi job per 10 secondi
if (stoppedRef.current) return;
```

Il flag viene resettato solo quando l'utente avvia manualmente un nuovo job.

### 3. Correggere auto-resume in `AcquisizionePartner.tsx`

- All'avvio (riga 640), NON auto-riprendere i job "running" — mostrarli come "paused" e richiedere un click manuale per riprendere
- Questo impedisce che un job fermato riparta automaticamente navigando tra le pagine

### 4. Rimuovere il dialog "Riprova"

- Eliminare il dialog "Riprova" (righe 1242-1284) e lo state `showRetryDialog`/`retryCount`
- I partner senza contatti restano nel database come "skipped" per revisione manuale futura
- Se l'utente vuole ritentarli, dovra' creare un nuovo job dedicato manualmente

---

## Dettaglio tecnico

### File: `src/hooks/useDownloadProcessor.ts`

1. Aggiungere `settingsRef` e `stoppedRef`:
```
const settingsRef = useRef(settings);
useEffect(() => { settingsRef.current = settings; }, [settings]);
const stoppedRef = useRef(false);
```

2. Dentro `processJob`, usare `settingsRef.current` invece di `settings` ovunque

3. Rimuovere `settings` dalle dipendenze di `processJob` e `useEffect`

4. Nel polling loop, aggiungere il guard:
```
if (stoppedRef.current || cancelRef.current) return;
```

5. In `emergencyStop`, aggiungere `stoppedRef.current = true`

6. Esporre un `resetStop` per permettere l'avvio manuale di nuovi job

### File: `src/pages/AcquisizionePartner.tsx`

1. Riga 640-663: Cambiare auto-resume in mostro-come-paused
2. Righe 1242-1284: Rimuovere il blocco dialog "Riprova" e gli state correlati (`showRetryDialog`, `retryCount`)
3. Riga 942-945: Rimuovere il trigger del dialog retry

### File modificati

1. `src/hooks/useDownloadProcessor.ts` — stabilizzazione refs, guard anti-restart, stoppedRef
2. `src/pages/AcquisizionePartner.tsx` — rimozione auto-resume e dialog retry
