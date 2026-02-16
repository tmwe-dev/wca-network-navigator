

# Fix: Race Condition nel Processore Download (Pagine Multiple Simultanee)

## Problema Identificato

Il processore di download puo avviare **piu estrazioni contemporanee** a causa di una race condition critica nella funzione `resetStop()`.

### La causa esatta

In `useDownloadProcessor.ts`, la funzione `resetStop` (riga 634) forza il rilascio del mutex:

```text
const resetStop = useCallback(() => {
    const state = getDlState();
    state.stopped = false;
    state.cancel = false;
    state.processing = false;  // <-- PERICOLO: forza il rilascio del mutex!
    const myId = ++state.activeLoopId;
    startLoop(myId);           // <-- Avvia un NUOVO loop
}, [startLoop]);
```

Scenario che causa il bug:
1. Il processore sta estraendo un profilo (loop A ha il mutex)
2. L'utente clicca STOP, poi avvia nuovi download
3. `onJobStarting` chiama `resetStop()` che forza `processing = false`
4. Il vecchio loop A continua a girare (non e stato ancora terminato)
5. Il nuovo loop B parte, trova il mutex libero, lo acquisisce
6. ORA DUE loop hanno il mutex e inviano richieste all'estensione Chrome contemporaneamente

### Secondo problema: HMR e remount

Ogni volta che React rimonta il componente (HMR durante lo sviluppo, navigazione), il `useEffect` di mount (riga 605) crea un NUOVO loop senza aspettare che il precedente sia terminato. I loop si sovrappongono brevemente.

---

## Piano di Intervento

### 1. Eliminare il force-release del mutex in resetStop

**File**: `src/hooks/useDownloadProcessor.ts`

`resetStop` NON deve mai forzare `processing = false`. Deve solo:
- Impostare i flag di cancellazione per far uscire il vecchio loop
- Abortare il controller corrente
- Aspettare che il vecchio loop rilasci il mutex naturalmente
- Solo DOPO avviare il nuovo loop

Nuova implementazione:

```text
const resetStop = useCallback(() => {
    const state = getDlState();
    // 1. Segnala al vecchio loop di uscire
    state.cancel = true;
    state.stopped = true;
    state.abortController?.abort();

    // 2. Aspetta che il mutex si liberi naturalmente, poi avvia
    const waitAndStart = async () => {
        let attempts = 0;
        while (state.processing && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        // 3. Reset flags e avvia nuovo loop
        state.stopped = false;
        state.cancel = false;
        const myId = ++state.activeLoopId;
        startLoop(myId);
    };
    waitAndStart();
}, [startLoop]);
```

### 2. Aggiungere serializzazione nell'extension bridge

**File**: `src/hooks/useExtensionBridge.ts`

Aggiungere una coda seriale a livello globale per `extractContacts`. Anche se due loop inviano richieste, solo una alla volta viene effettivamente inviata all'estensione:

```text
// Singleton queue per garantire una sola estrazione alla volta
const EXTRACT_LOCK_KEY = '__extractContactsLock__';

function getExtractLock() {
    if (!(window as any)[EXTRACT_LOCK_KEY]) {
        (window as any)[EXTRACT_LOCK_KEY] = { busy: false, queue: [] };
    }
    return (window as any)[EXTRACT_LOCK_KEY];
}
```

Questo agisce come **safety net di ultimo livello**: anche se il mutex del processore fallisce per qualche edge case, l'estensione Chrome riceve comunque una sola richiesta alla volta.

### 3. Proteggere il mount useEffect da loop duplicati

**File**: `src/hooks/useDownloadProcessor.ts`

Il `useEffect` di mount deve verificare che non ci sia gia un loop attivo prima di avviarne uno nuovo:

```text
useEffect(() => {
    const state = getDlState();
    // Se c'e gia un loop attivo e non e stato fermato, non avviarne un altro
    if (state.processing && !state.stopped && !state.cancel) {
        return;
    }
    state.cancel = false;
    state.stopped = false;
    const myId = ++state.activeLoopId;
    startLoop(myId);
    return () => { state.cancel = true; };
}, []);
```

### 4. Aggiungere log diagnostico per rilevare sovrapposizioni

**File**: `src/hooks/useDownloadProcessor.ts`

Aggiungere un `console.warn` nel punto critico dove il mutex viene acquisito, se risulta gia acquisito:

```text
if (state.processing) {
    console.warn("[DownloadProcessor] RACE DETECTED: mutex already held!");
    // Non acquisire, aspetta
    continue;
}
```

---

## Dettagli Tecnici

### File modificati

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadProcessor.ts` | Fix resetStop, mount guard, race detection |
| `src/hooks/useExtensionBridge.ts` | Coda seriale per extractContacts |

### Garanzie dopo il fix

1. **resetStop** non forza mai il rilascio del mutex -- aspetta che il loop corrente esca
2. **extractContacts** ha una coda seriale globale -- massimo 1 richiesta all'estensione alla volta
3. **Mount/HMR** non crea loop duplicati se uno e gia attivo
4. **Emergency stop** continua a funzionare istantaneamente (abort + DB update)
5. I 5 livelli di protezione esistenti (mutex, loopId, atomic claim, running check, keep-alive) restano tutti attivi

### Nessun impatto su altre funzionalita

- La directory scan (ActionPanel) non e toccata -- usa un flusso separato
- I pulsanti STOP, Elimina, Pulisci cronologia continuano a funzionare
- La creazione seriale dei job (uno per paese) resta invariata

