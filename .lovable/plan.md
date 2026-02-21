
# Badge "D" Deep Search + Filtro

## Cosa cambia

Ogni partner che ha completato la Deep Search mostrerà un badge **"D" azzurro** ben visibile, sia nella lista del Partner Hub (sidebar) che nella Country Workbench. In più, si aggiunge un filtro per isolare i partner senza Deep Search.

## Come si riconosce la Deep Search

Il campo `enrichment_data.deep_search_at` viene salvato dalla edge function quando la Deep Search viene completata. Se presente, il partner è stato "deep-searched".

## Modifiche

### 1. Partner Hub - Lista partner (sidebar sinistra)

**File**: `src/pages/PartnerHub.tsx`

- Accanto al nome/città del partner, aggiungere un badge **"D"** azzurro (sfondo `bg-sky-500`, testo bianco, piccolo e rotondo) con tooltip "Deep Search completata il [data]"
- Il badge appare solo se `(partner.enrichment_data as any)?.deep_search_at` esiste

### 2. Country Workbench - Lista partner per paese

**File**: `src/components/partners/CountryWorkbench.tsx`

- Stessa "D" azzurra accanto al nome del partner nella lista
- Aggiungere ai **filtri positivi** un nuovo chip: **"Deep"** con icona e conteggio dei partner deep-searched
- Aggiungere ai **filtri negativi** (dropdown "Mancanti..."): **"Senza Deep Search"** con il conteggio
- Aggiornare il tipo `WorkbenchFilter` con `"deep_search"` e `"no_deep_search"`
- Aggiornare le statistiche per contare i partner con/senza deep search
- Aggiornare la logica di filtraggio

### 3. Partner Card (vista a griglia)

**File**: `src/components/partners/PartnerCard.tsx`

- Nella riga dei badge (tipo partner, anni membership, qualità contatti), aggiungere il badge "D" azzurro se il partner ha deep_search_at

## Dettagli Tecnici

### Helper per identificare Deep Search
```
const hasDeepSearch = (p: any) => !!(p.enrichment_data as any)?.deep_search_at;
```

### Badge "D" (componente inline)
Un piccolo cerchio/badge azzurro con la lettera "D" maiuscola:
- Dimensione: `w-5 h-5` (o simile)
- Stile: `bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center`
- Tooltip: "Deep Search - [data]"

### Filtri aggiornati in CountryWorkbench
- Tipo `WorkbenchFilter` diventa: `"all" | "with_phone" | "with_email" | "deep_search" | "no_phone" | "no_email" | "no_profile" | "no_deep_search"`
- Nuovo chip positivo: `{ key: "deep_search", label: "Deep", count: stats.withDeepSearch }`
- Nuovo item negativo: `{ key: "no_deep_search", label: "Senza Deep Search", count: stats.noDeepSearch }`

### File da modificare
1. `src/pages/PartnerHub.tsx` - Badge "D" nella lista sidebar
2. `src/components/partners/CountryWorkbench.tsx` - Badge "D" nella lista + filtri deep search
3. `src/components/partners/PartnerCard.tsx` - Badge "D" nella card a griglia
