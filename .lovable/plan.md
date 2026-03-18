

## Riorganizzazione layout CountryWorkbench

### Modifiche in `src/components/partners/CountryWorkbench.tsx`

#### 1. Network dropdown → header
Spostare il `Select` del network dalla sezione "DROPDOWN FILTERS" (righe 346-384) all'header (righe 228-243), posizionandolo tra il nome del paese e il contatore partner. Compatto, inline.

#### 2. "Cerca partner" → riga "Seleziona tutti"
Rimuovere la sezione "SEARCH" separata (righe 245-256). Integrare l'input di ricerca nella riga "SELECT ALL" (righe 386-398), affiancandolo alla checkbox "Seleziona tutti". Layout: `[☐ Seleziona tutti] [🔍 Cerca partner...]`

#### 3. Sezione dropdown filters
Rimuovere la sezione "DROPDOWN FILTERS" (righe 346-384) — il network dropdown è spostato in header, il dropdown filiali resta nella riga dei sort/servizi oppure viene integrato anch'esso.

### Modifiche in `src/pages/PartnerHub.tsx`

#### 4. "Cerca paese" → ridotto, a sinistra
Quando `viewLevel === "country"`, nascondere o ridurre il search bar nel parent header (righe 321-330) dato che non serve cercare paesi quando si è dentro un paese specifico. In alternativa, ridurre la larghezza del campo "Cerca paese" e lasciarlo visibile solo in vista `"countries"`.

### Layout risultante CountryWorkbench

```text
┌─────────────────────────────────────────────────┐
│ ← 🇦🇱 Albania  [▾ Network]         9 / 11     │  ← header con network dropdown
├─────────────────────────────────────────────────┤
│ [👤¹][📍][⭐²][🏆] │ ✈🚢📦🚛  [▾ Filiali] [✕] │  ← sort + servizi + filiali
├─────────────────────────────────────────────────┤
│ ☐ Seleziona tutti    [🔍 Cerca partner...]      │  ← checkbox + search uniti
├─────────────────────────────────────────────────┤
│ Partner cards...                                 │
└─────────────────────────────────────────────────┘
```

### File coinvolti
- `src/components/partners/CountryWorkbench.tsx`
- `src/pages/PartnerHub.tsx` (nascondere search quando viewLevel === "country")

