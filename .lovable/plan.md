
# Fix: Processi Multipli che Partono Contemporaneamente

## Problema Identificato

Il processore di download ha due vulnerabilita' che permettono a piu' job di partire simultaneamente, violando il vincolo di esecuzione sequenziale.

### Causa 1 — Ordine errato nel lock del database

Nel metodo `processJob` (riga 137), il job viene impostato come `running` **prima** di verificare se ci sono altri job gia' in esecuzione (riga 141). Questo crea una finestra temporale in cui:

1. Loop A trova un job pending, lo mette in "running"
2. Loop B (o un secondo polling) controlla i running, non ne trova (il commit di A non e' ancora visibile), prende un altro job pending
3. Risultato: 2 job running contemporaneamente

La correzione e': invertire l'ordine. Prima si verifica che non ci siano altri running, poi si imposta lo stato.

### Causa 2 — Loop duplicati da `resetStop`

La funzione `resetStop` (riga 555) fa tre cose:
- Resetta `processing = false`
- Incrementa `activeLoopId`
- Chiama `startLoop(myId)` creando un NUOVO loop

Ma se il componente Operations viene anche rimontato (es. HMR o navigazione), il `useEffect` al mount (riga 537) crea un ALTRO loop. Cosi' si ritrovano 2+ loop attivi. Il meccanismo `activeLoopId` dovrebbe invalidare quelli vecchi, ma il reset simultaneo di `cancel` e `processing` permette ai loop orfani di sopravvivere per un ciclo.

### Causa 3 — Mutex non-atomico nel polling

Nel loop di polling (riga 488-493), il controllo `if (state.processing)` avviene PRIMA della query DB (che e' asincrona). Due loop possono entrambi vedere `processing = false`, entrambi eseguire la query, e entrambi chiamare `processJob`. Il mutex in `processJob` (riga 107) e' sincrono e dovrebbe catturare il secondo, ma solo se entrano nella funzione in sequenza — con i tempi stretti del "RIAVVIA TUTTI" questo non e' garantito.

## Correzioni

### 1. Invertire ordine: prima verifica, poi claim

Spostare il controllo DB "altri job running?" PRIMA di impostare il job corrente come "running". Solo dopo aver confermato che il campo e' libero, fare l'update a "running".

### 2. Claim atomico con WHERE condizionale

Sostituire il semplice `update({ status: "running" })` con un update condizionale che riesce solo se il job e' ancora "pending":

```text
UPDATE download_jobs 
SET status = 'running' 
WHERE id = jobId AND status = 'pending'
RETURNING id
```

Se l'update non restituisce righe, significa che un altro loop ha gia' preso il job — si esce senza processare.

### 3. Lock globale prima di processare

Aggiungere un controllo a livello di database prima di ogni `processJob`: contare i job con status "running". Se ce n'e' gia' uno, non procedere. Questo va fatto PRIMA di qualsiasi update di stato.

### 4. Eliminare loop duplicati da `resetStop`

Modificare `resetStop` per NON chiamare `startLoop` direttamente. Invece, deve solo resettare i flag (`stopped`, `cancel`) e lasciare che il `useEffect` del mount rilanci il loop automaticamente tramite un re-render forzato. Questo garantisce un solo loop attivo alla volta.

In pratica:
- `resetStop` resetta i flag e incrementa `activeLoopId`
- Un `useEffect` con dipendenza su un contatore di reset rileva il cambio e avvia UN solo loop

### 5. Aggiungere guardia anti-rientro nel polling

Nel loop di polling, prima di chiamare `processJob`, acquisire il mutex `state.processing = true` gia' nel loop (non dentro processJob). Cosi' il check e il set sono nello stesso tick sincrono, senza await in mezzo.

## File da Modificare

| File | Modifica |
|---|---|
| `src/hooks/useDownloadProcessor.ts` | Riscrittura ordine lock, claim atomico, eliminazione loop duplicati |

## Comportamento Atteso Dopo il Fix

- Un solo loop di polling attivo in qualsiasi momento
- Un solo job in stato "running" in qualsiasi momento
- Il "RIAVVIA TUTTI" resetta i flag ma non crea loop extra
- Se due loop tentano di prendere lo stesso job, il secondo fallisce silenziosamente
- Il cruscotto (SpeedGauge) mostra un solo processo alla volta
