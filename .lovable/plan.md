

# Fix duplicazione: loop immune a HMR e re-render

## Causa radice confermata dal terminal log

Il terminal log del job Afghanistan mostra chiaramente ogni riga duplicata (INFO x2, START x2, OK x2, WAIT x2), tutte allo stesso secondo. Due istanze concorrenti di `processJob` stanno girando sullo stesso profilo.

La causa e' duplice:

### Bug 1: il while loop non controlla moduleCancel
Dopo che il cleanup setta `moduleCancel = true`, il vecchio `processJob` esce (break al for-loop). Ma il while loop continua: la sua condizione e' `moduleLoopRunning && !moduleStopped`, che NON controlla `moduleCancel`. Il loop trova lo stesso job "running", resetta `moduleCancel = false` (riga 429), e richiama processJob.

### Bug 2: HMR resetta le variabili di modulo
Durante l'Hot Module Replacement (sviluppo), il modulo viene ricaricato da zero. Le variabili `moduleCancel`, `moduleStopped`, `moduleLoopRunning` vengono reinizializzate a `false`. Il nuovo mount crea un nuovo loop mentre il vecchio codice async e' ancora in esecuzione nel suo contesto JavaScript.

## Soluzione

### File: `src/hooks/useDownloadProcessor.ts`

**Cambiamento 1: Usare un ID univoco per il loop**

Invece di un booleano `moduleLoopRunning`, usare un **ID di sessione** (numero incrementale). Ogni loop conosce il proprio ID. Se l'ID corrente non corrisponde a quello attivo, il loop si ferma. Questo e' immune a HMR perche' il nuovo modulo genera un nuovo ID.

```text
Prima:
  let moduleLoopRunning = false;

Dopo:
  let activeLoopId = 0;        // ID della sessione loop attiva
  let currentLoopId = 0;       // contatore incrementale
```

**Cambiamento 2: il while loop controlla anche moduleCancel**

```text
Prima:
  while (moduleLoopRunning && !moduleStopped) {

Dopo:
  while (myId === activeLoopId && !moduleStopped && !moduleCancel) {
```

**Cambiamento 3: processJob controlla il loop ID**

Dentro processJob, prima di ogni operazione critica (apertura tab via estensione), verificare che il loop sia ancora quello attivo. Se non lo e', uscire immediatamente.

**Cambiamento 4: rimuovere il reset di moduleCancel dentro il loop**

La riga 429 (`moduleCancel = false`) viene spostata FUORI dal loop, nel punto dove l'utente esplicitamente avvia/riprende un job (resetStop), non nel loop automatico.

**Cambiamento 5: rimuovere la dipendenza da processJob nel useEffect**

Il useEffect del loop non deve dipendere da `[processJob]`. Deve avere `[]` come dependencies (mount-only). `processJob` viene gia' acceduto tramite ref, quindi la dipendenza e' inutile e causa re-run del useEffect.

### Implementazione dettagliata

```typescript
// ── MODULE-LEVEL singleton state ──
let moduleCancel = false;
let moduleStopped = false;
let activeLoopId = 0;

// Dentro il componente:

// Il processJob deve ricevere il loopId come parametro
const processJob = useCallback(async (job: any, loopId: number) => {
  // ... tutto come prima, ma ogni check diventa:
  if (moduleCancel || moduleStopped || loopId !== activeLoopId) break;
  // ... e prima di extractContacts:
  if (loopId !== activeLoopId) return; // loop cambiato, non aprire tab
}, [queryClient]);

const processJobRef = useRef(processJob);
useEffect(() => { processJobRef.current = processJob; }, [processJob]);

// Il loop usa [] come dependencies (mount-only)
useEffect(() => {
  const myId = ++activeLoopId; // Nuova sessione, invalida la precedente

  const loop = async () => {
    while (myId === activeLoopId && !moduleStopped && !moduleCancel) {
      // ... trova job ...
      if (job) {
        await processJobRef.current(job, myId);
        // ... cooldown ...
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  };

  loop();
  return () => {
    moduleCancel = true;
    // Il vecchio loop uscira' perche' moduleCancel = true
    // Il NUOVO mount generera' un nuovo myId che invalida il vecchio
  };
}, []); // NESSUNA dipendenza — mount-only
```

### Riepilogo cambiamenti

Un solo file: `src/hooks/useDownloadProcessor.ts`

1. Sostituire `moduleLoopRunning` con `activeLoopId` (contatore incrementale)
2. Aggiungere `loopId` come parametro di `processJob` e verificarlo prima di ogni operazione critica
3. Aggiungere `processJobRef` per accedere a processJob senza dipendenza nel useEffect
4. Cambiare la condizione while per controllare `myId === activeLoopId && !moduleStopped && !moduleCancel`
5. Cambiare dependencies del useEffect da `[processJob]` a `[]`
6. Rimuovere `moduleCancel = false` dal loop (riga 429) — il reset avviene solo in `resetStop`
7. Aggiornare `emergencyStop` e `resetStop` per lavorare con `activeLoopId`
