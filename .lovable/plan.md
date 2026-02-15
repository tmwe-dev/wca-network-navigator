

# Fix definitivo: singleton a livello di modulo

## Causa radice trovata

Il problema NON e' nel loop (il `while` loop e' corretto). Il problema e' che `cancelRef` e `stoppedRef` sono creati DENTRO il componente (righe 21-22). Quando il componente si rimonta (HMR, navigazione, re-render profondo):

```text
VECCHIO componente:
  cancelRef_OLD = useRef(false)     <-- oggetto A
  loop_OLD -> processJob_OLD -> extractContacts(wcaId) [in attesa 60s]

Cleanup: cancelRef_OLD.current = true   <-- imposta oggetto A

NUOVO componente:
  cancelRef_NEW = useRef(false)     <-- oggetto B (NUOVO, inizializzato a false!)
  loop_NEW -> trova stesso job "running" -> processJob_NEW -> extractContacts(wcaId) [DUPLICATO!]
```

Due oggetti ref diversi. Il vecchio `processJob` non sa che il nuovo esiste. Due tab si aprono per lo stesso profilo.

## Soluzione

Spostare TUTTI i flag di controllo a livello di modulo (fuori dalla funzione `useDownloadProcessor`). Cosi' sopravvivono ai remount e c'e' un solo stato globale.

### File: `src/hooks/useDownloadProcessor.ts`

**Prima del componente** (righe 1-16), aggiungere:

```typescript
// ── MODULE-LEVEL singleton state (survives component remounts) ──
let moduleCancel = false;
let moduleStopped = false;
let moduleLoopRunning = false;  // true = un loop e' gia' attivo, non crearne un altro
```

**Dentro il componente**, eliminare le righe 21-22 (`cancelRef`, `stoppedRef`) e sostituire ogni riferimento:

- `cancelRef.current` diventa `moduleCancel`
- `stoppedRef.current` diventa `moduleStopped`

**Nel `useEffect` del loop** (riga 369), aggiungere una guardia singleton:

```typescript
useEffect(() => {
  // Se un loop e' gia' attivo (da un mount precedente), non crearne un altro
  if (moduleLoopRunning) return;
  moduleLoopRunning = true;

  const loop = async () => {
    while (moduleLoopRunning && !moduleStopped) {
      // ... logica esistente invariata, ma con moduleCancel/moduleStopped ...
    }
    moduleLoopRunning = false;
  };

  loop();
  return () => {
    moduleCancel = true;
    // NON impostare moduleLoopRunning = false qui!
    // Il loop si fermera' da solo quando vede moduleCancel = true
  };
}, [processJob]);
```

**`processJob`**: sostituire tutti i `cancelRef.current` con `moduleCancel` e `stoppedRef.current` con `moduleStopped`. Circa 10 sostituzioni meccaniche.

**`emergencyStop` e `resetStop`**:

```typescript
const emergencyStop = useCallback(() => {
  moduleCancel = true;
  moduleStopped = true;
}, []);

const resetStop = useCallback(() => {
  moduleStopped = false;
  moduleCancel = false;
  moduleLoopRunning = false;  // permette al prossimo mount di avviare un nuovo loop
}, []);
```

### Riepilogo cambiamenti

Un solo file: `src/hooks/useDownloadProcessor.ts`

1. Aggiungere 3 variabili a livello di modulo (`moduleCancel`, `moduleStopped`, `moduleLoopRunning`)
2. Rimuovere `cancelRef` e `stoppedRef` (useRef)
3. Sostituire meccanicamente ogni `.current` con la variabile di modulo corrispondente
4. Aggiungere guardia `if (moduleLoopRunning) return` nel useEffect del loop
5. Aggiornare cleanup, emergencyStop e resetStop

Zero modifiche alla logica di processJob, all'estrazione contatti, o al salvataggio dati. Solo i flag di controllo cambiano da ref locale a variabile di modulo.

