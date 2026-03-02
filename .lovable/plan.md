

## Piano: Deep Search persistente in background

### Problema
Il Partner Hub usa una propria implementazione locale della Deep Search (`handleBulkDeepSearch`, `handleCountryDeepSearch`) con stato locale (`deepSearching`, `deepSearchProgress`, `deepSearchAbortRef`). Quando l'utente naviga via dalla pagina, il componente si smonta e il processo si interrompe.

Esiste già un sistema globale (`useDeepSearchRunner` montato in `AppLayout` → `DeepSearchContext`) che sopravvive alla navigazione, ma il Partner Hub non lo usa.

### Soluzione

**1. Partner Hub → usa il context globale** (`src/pages/PartnerHub.tsx`)
- Rimuovere tutto lo stato locale della Deep Search: `deepSearching`, `deepSearchProgress`, `deepSearchAbortRef`, `handleBulkDeepSearch`, `handleCountryDeepSearch`, `handleStopDeepSearch`
- Importare `useDeepSearch()` dal context globale
- Collegare `BulkActionBar` e `CountryWorkbench` allo stato globale: `deepSearch.running`, `deepSearch.start(ids)`, `deepSearch.stop()`
- Derivare `deepSearchProgress` da `deepSearch.current` (ha `index` e `total`)
- Passare i partner nell'ordine della lista visibile a `deepSearch.start()`

**2. Aggiornamento live per-partner nel runner globale** (`src/hooks/useDeepSearchRunner.ts`)
- Dopo ogni partner completato con successo, aggiungere `queryClient.invalidateQueries({ queryKey: ["partners"] })` dentro il loop, così le card nel Partner Hub si aggiornano in tempo reale
- Auto-selezionare il partner corrente non è possibile dal runner globale (non ha accesso a `setSelectedId`), ma il refresh della cache farà "prendere vita" le card man mano

**3. Fix PageFallback** (`src/App.tsx`)
- Sostituire lo `Skeleton` visibile con un `div` vuoto e trasparente per eliminare il flash di caricamento

### Riepilogo file

| File | Modifica |
|------|----------|
| `src/pages/PartnerHub.tsx` | Rimuovere stato/logica locale Deep Search, usare `useDeepSearch()` dal context globale |
| `src/hooks/useDeepSearchRunner.ts` | Aggiungere `queryClient.invalidateQueries` dopo ogni partner nel loop per aggiornamento live |
| `src/App.tsx` | Sostituire `PageFallback` con div vuoto trasparente |

