

## Piano: Linguetta verde completamento + Filtri paese per qualità dati

### 1. Linguetta verde sul bordo sinistro delle country card (`CountryGrid.tsx`)

Nella `CountryCard`, aggiungere un bordo sinistro colorato in base allo stato completamento:
- **Verde (emerald-500)**: `isDone` — tutti scaricati E tutti con profilo
- **Ambra (amber-500)**: scaricati al 100% ma con profili mancanti (`dlPct >= 100 && noProfile > 0`)
- Nessuna linguetta per gli altri stati

Implementazione: aggiungere `border-l-[3px]` con il colore appropriato alla card.

### 2. Filtri qualità dati nella CountryGrid (`CountryGrid.tsx` + `Operations.tsx`)

Espandere il tipo `FilterKey` con nuovi valori:
```
"no_email" | "no_phone" | "no_deep"
```

Aggiungere chip filtro cliccabili nella toolbar della griglia paesi (sotto la barra di ricerca), stessa logica delle StatPill in alto:
- **No Profilo** — paesi con `without_profile > 0`
- **No Email** — paesi con partner senza email (`total - with_email > 0`)
- **No Tel** — paesi con partner senza telefono (`total - with_phone > 0`)
- **No Deep** — paesi con partner senza deep search (`total - with_deep_search > 0`)

Ogni chip mostra il conteggio di paesi che rientrano in quel criterio. Cliccando si filtra la griglia per mostrare solo quei paesi.

### 3. Logica di filtraggio nella `CountryGrid`

Nella sezione `filtered`, aggiungere i nuovi casi:
```typescript
if (filterMode === "no_email") return (s?.total_partners || 0) - (s?.with_email || 0) > 0;
if (filterMode === "no_phone") return (s?.total_partners || 0) - (s?.with_phone || 0) > 0;
if (filterMode === "no_deep") return (s?.total_partners || 0) - (s?.with_deep_search || 0) > 0;
```

### 4. Propagazione filtro da StatPill in alto (`Operations.tsx`)

Le StatPill "No Email", "No Tel" nella top bar attualmente non hanno `onClick`. Aggiungere `onClick` per settare il `filterMode` corrispondente, in modo che cliccando lì si filtri anche la griglia paesi.

### File da modificare

| File | Modifica |
|------|----------|
| `src/components/download/CountryGrid.tsx` | Linguetta verde, nuovi filtri, chip filtro, expand FilterKey |
| `src/pages/Operations.tsx` | onClick su StatPill No Email/No Tel/No Deep, passare filterMode aggiornato |

