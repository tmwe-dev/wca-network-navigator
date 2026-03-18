

## Country Workbench — Multi-sort, rimozione filtri generici, riposizionamento flag e icona network

### 1. Multi-sort con stati colorati (off → blu asc → rosso desc → off)

Sostituire il sistema single-sort con un array ordinato di criteri. Ogni click su un'icona di sort:
- Se il campo non è attivo → lo aggiunge in coda con direzione default (asc per name/city, desc per rating/years)
- Se è attivo asc (blu) → passa a desc (rosso)
- Se è attivo desc (rosso) → lo rimuove

**Nuovo stato:**
```typescript
type SortEntry = { field: SortField; dir: SortDir };
const [sortStack, setSortStack] = useState<SortEntry[]>([{ field: "name", dir: "asc" }]);
```

**Logica di sort:** applica i criteri in sequenza (primo criterio primario, secondo secondario, ecc.)

**Colori:** `text-blue-400` per asc, `text-red-400` per desc, con ChevronUp/ChevronDown corrispondente. Badge numerico piccolo per indicare la priorità (1, 2, 3...).

### 2. Rimuovere filtri generici Deep Search e Rating

Eliminare completamente:
- `activeGenericFilters` state e `toggleGenericFilter`
- `genericCounts` memo
- `genericChips` array
- La sezione UI dei generic filter chips (righe 263-291)
- `GenericFilter` type, `GENERIC_FILTER_FNS`
- Rimuovere `activeGenericFilters` dalla logica `filteredPartners` e `hasAnyFilter`

### 3. Spostare flag nella colonna destra, accanto ai network

- **Rimuovere** `<span className="text-xs leading-none">{flag}</span>` dalla colonna sinistra (riga 422)
- **Aggiungere** la bandiera nella colonna destra, accanto al conteggio network: `🇹🇭 👥 3` sulla stessa riga

### 4. Cambiare icona network

Sostituire `Users` con un'icona più rappresentativa per i network di appartenenza. Usare `Network` o `Globe` da lucide-react (es. `Globe` per rappresentare network internazionali).

### Layout risultante toolbar
```text
┌──────────────────────────────────────────────┐
│ 🔍 Cerca partner...                         │
├──────────────────────────────────────────────┤
│ [👤¹][📍][⭐²][🏆] │ ✈🚢📦🚛🚂⚠        [✕]│
├──────────────────────────────────────────────┤
│ Network: [▾ Tutti]   Filiali: [▾ Tutti]     │
└──────────────────────────────────────────────┘
```

Sort icons: blu=asc, rosso=desc, grigio=inattivo. Badge numerico per priorità.

### Layout card destra
```text
🏆 12
🇹🇭 🌐 3
⭐⭐⭐⭐ 4.2
```

### File: `src/components/partners/CountryWorkbench.tsx` — unico file

