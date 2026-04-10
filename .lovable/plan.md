

# Piano: Refactor GlobalFiltersContext da 33 setter a useReducer

## Problema attuale

`GlobalFiltersContext.tsx` (203 LOC) definisce 33 setter individuali con `useCallback`, ognuno identico nel pattern (`setFilters(p => ({ ...p, key: value }))`). Questo causa:
- **Boilerplate**: 33 righe di `useCallback` + 33 righe nell'interfaccia + 33 righe nel Provider value
- **Nessun batch update**: cambiare 3 filtri insieme causa 3 re-render separati
- **Interfaccia fragile**: ogni nuovo filtro richiede modifiche in 4 punti (tipo, interfaccia, setter, provider value)

## Soluzione

Sostituire i 33 setter con un `useReducer` che espone:
1. **`dispatch`** -- per azioni tipizzate (`SET_FIELD`, `RESET`, `BATCH`)
2. **`setFilter(key, value)`** -- helper generico che wrappa dispatch
3. **`batchUpdate(partial)`** -- per aggiornare N filtri in un singolo render

## Impatto sui consumer (18 file)

L'API pubblica cambia da:
```typescript
// Prima
const { setSearch, setSortBy, setCrmQuality } = useGlobalFilters();
setSearch("test");
setSortBy("date");
```

A:
```typescript
// Dopo
const { setFilter, batchUpdate } = useGlobalFilters();
setFilter("search", "test");
// oppure batch:
batchUpdate({ search: "test", sortBy: "date" });
```

I 33 setter individuali vengono **mantenuti come alias retrocompatibili** generati automaticamente, quindi i 18 file consumer non devono cambiare immediatamente. Possono essere migrati gradualmente.

## File da modificare

### 1. `src/contexts/GlobalFiltersContext.tsx` (riscrittura completa)

```text
Prima (203 LOC)                    Dopo (~120 LOC)
─────────────────                  ──────────────
33 useCallback setter              1 useReducer
33 righe interfaccia setter        3 metodi: setFilter, batchUpdate, resetFilters
33 righe Provider value            alias retrocompatibili generati con loop
```

Struttura del reducer:
```typescript
type FilterAction =
  | { type: "SET"; key: keyof GlobalFilterState; value: any }
  | { type: "BATCH"; updates: Partial<GlobalFilterState> }
  | { type: "RESET" };

function filterReducer(state: GlobalFilterState, action: FilterAction) {
  switch (action.type) {
    case "SET": return { ...state, [action.key]: action.value };
    case "BATCH": return { ...state, ...action.updates };
    case "RESET": return cloneDefaults();
  }
}
```

Alias retrocompatibili (generati, non scritti a mano):
```typescript
const setters = Object.fromEntries(
  Object.keys(defaults).map(key => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    (val: any) => dispatch({ type: "SET", key, value: val })
  ])
);
```

### 2. Nessun altro file cambia

Grazie agli alias retrocompatibili, tutti i 18 file consumer (`ContactStream`, `CRMFiltersSection`, `NetworkFilterSlot`, ecc.) continuano a funzionare senza modifiche.

## Vantaggi

- **-80 LOC** nel context (da 203 a ~120)
- **Batch updates**: `batchUpdate({ search: "", quality: "all", sortBy: "name" })` = 1 render invece di 3
- **Scalabilita**: aggiungere un nuovo filtro richiede solo 1 riga in `GlobalFilterState` e 1 in `defaults`
- **Zero breaking changes**: alias garantiscono retrocompatibilita

## Rischio

Basso. Il reducer e un pattern React standard. Gli alias mantengono la firma identica. Il build e i test esistenti coprono la verifica.

