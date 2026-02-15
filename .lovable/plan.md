

# Fix DEFINITIVO: anti-duplicazione immune a HMR

## Problema confermato

Il terminal log di Algeria mostra ANCORA duplicazioni su ogni profilo dal #2 in poi (START x2, OK x2, WAIT x2). Il fix con `activeLoopId` a livello di modulo NON funziona.

## Causa radice

Quando Vite esegue un Hot Module Replacement (HMR):
1. Crea un NUOVO modulo JavaScript con variabili NUOVE (`activeLoopId = 0`)
2. Il vecchio modulo e i suoi loop async continuano a girare nel vecchio contesto JS
3. Il vecchio loop controlla `myId === activeLoopId` contro la SUA copia di `activeLoopId` -- che corrisponde sempre
4. Il nuovo modulo incrementa la SUA copia a 1, ma il vecchio loop non la vede

In pratica: le variabili a livello di modulo NON sopravvivono all'HMR nel modo sperato. Ogni istanza del modulo ha la propria copia.

## Soluzione

Spostare lo stato singleton su `window` (oggetto globale del browser), che e' l'UNICO posto condiviso tra tutte le istanze del modulo durante l'HMR.

### File: `src/hooks/useDownloadProcessor.ts`

Sostituire le variabili a livello di modulo con proprieta' su `window`:

```text
Prima (NON FUNZIONA con HMR):
  let moduleCancel = false;
  let moduleStopped = false;
  let activeLoopId = 0;

Dopo (IMMUNE a HMR):
  const DL_STATE_KEY = '__dlProcessorState__';
  
  interface DlProcessorState {
    cancel: boolean;
    stopped: boolean;
    activeLoopId: number;
  }
  
  function getDlState(): DlProcessorState {
    if (!(window as any)[DL_STATE_KEY]) {
      (window as any)[DL_STATE_KEY] = {
        cancel: false,
        stopped: false,
        activeLoopId: 0,
      };
    }
    return (window as any)[DL_STATE_KEY];
  }
```

Ogni accesso a `moduleCancel`, `moduleStopped`, `activeLoopId` diventa:

```text
const state = getDlState();
state.cancel = true;          // invece di moduleCancel = true
state.activeLoopId++;          // invece di ++activeLoopId
```

Il while loop:

```text
const state = getDlState();
const myId = ++state.activeLoopId;

while (myId === state.activeLoopId && !state.stopped && !state.cancel) {
  ...
}
```

In questo modo, quando HMR crea un nuovo modulo:
- Il nuovo modulo chiama `getDlState()` e ottiene LO STESSO oggetto del vecchio
- Incrementa `activeLoopId` -- il vecchio loop vede il cambio perche' condividono lo stesso oggetto
- Il vecchio loop esce immediatamente al prossimo check

### Modifiche specifiche

1. Rimuovere le 3 variabili a livello di modulo (`moduleCancel`, `moduleStopped`, `activeLoopId`)
2. Aggiungere `getDlState()` che usa `window.__dlProcessorState__`
3. Sostituire OGNI riferimento a `moduleCancel` con `state.cancel`
4. Sostituire OGNI riferimento a `moduleStopped` con `state.stopped`
5. Sostituire OGNI riferimento a `activeLoopId` con `state.activeLoopId`
6. Il `processJob`, il loop `useEffect`, `emergencyStop` e `resetStop` usano tutti `getDlState()`
7. Il cleanup del `useEffect` setta `state.cancel = true`
8. Il `resetStop` resetta `state.cancel = false`, `state.stopped = false` e incrementa `state.activeLoopId`

### Nessun altro file modificato

Un solo file: `src/hooks/useDownloadProcessor.ts`

