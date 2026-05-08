## Obiettivo
Due fix UI sulle CompanyCard di `/v2/explore/network` (e ContactsPage) per coerenza con le regole della pagina:

1. **Chip filtri rimovibili** — ogni badge nella `ActiveFiltersBar` deve avere una `X` che toglie quel singolo filtro (sequenziale, uno alla volta).
2. **Icone canali allineate** — Mail / WhatsApp / LinkedIn / Phone / Website oggi appaiono sparse "in fondo al testo" sulla destra; vanno tutte **allineate a sinistra**, su più colonne se serve, e wrappano sulla riga successiva sempre allineate a sinistra.

---

### 1) Chip con X di rimozione

**File**: `src/v2/ui/molecules/ActiveFiltersBar/ActiveFiltersBar.tsx`
- Aggiungere prop opzionale `onRemove?: (chipKey: string) => void`.
- Quando presente, ogni chip mostra un pulsante `X` (icona `lucide X`, `w-2.5 h-2.5`) con `onClick` → `onRemove(chip.key)`. `stopPropagation` per non aprire la card.
- Stile: `ml-0.5`, hover sfondo soft, accessibile (`aria-label="Rimuovi filtro {label}"`).

**File**: `src/v2/ui/pages/NetworkPage.tsx` (e analogo `ContactsPage.tsx`)
- Aggiungere handler `handleRemoveWcaChip(key: string)` che, in base al prefisso della key, chiama il setter giusto su `useGlobalFilters`:
  - `country:XX` → rimuove `XX` da `networkSelectedCountries`
  - `search:...` → `setNetworkSearch("")`
  - `holding:in|all` → `setHoldingPattern("out")` (default)
  - (CRM) `origin:...` → rimuove da `crmOrigin`
  - (CRM) `quality:...` → `setCrmQuality("all")`
  - (CRM) `channel:...` → `setCrmChannel("all")`
  - (CRM) `wca:...` → `setCrmWcaMatch("all")`
- Passare l'handler a `<ActiveFiltersBar onRemove={...} />`.

Nessuna modifica all'hook `useActiveFilterChips` (le key esistono già con il formato `tipo:valore`).

---

### 2) Icone canali sempre allineate a sinistra

Problema: in `EntityRow.tsx` col 4 (modalità wide) le `ChannelIcons` stanno sotto la città, in una riga `flex` insieme allo `ScorePill`. Visivamente sembrano "appese in fondo al testo" perché il blocco è stretto (200px) e galleggia a destra della card.

**File**: `src/v2/ui/atoms/EntityRow.tsx`
- In modalità **wide** (non compact) spostare `ChannelIcons` **fuori dalla col 4**, in una riga dedicata sotto `titleSlot`/`subTitleSlot` dentro la **col 3** (sempre `flex flex-wrap gap-1.5 items-center justify-start mt-1`).
- Lo `ScorePill` resta in col 4 (è una metrica numerica, non un canale).
- In **compact** uguale: `ChannelIcons` su riga propria, allineata a sinistra (`justify-start`), wrap automatico.
- `ChannelIcons` viene così sempre `text-left` con `flex-wrap`, e se la riga finisce va a capo allineata a sinistra (richiesta esplicita).

**File**: `src/v2/ui/atoms/ChannelIcons.tsx` (verifica veloce)
- Assicurarsi che il container sia `inline-flex flex-wrap gap-1 justify-start` (no `justify-end` né `ml-auto`).

Nessun cambio di logica: solo posizione DOM e classi.

---

### Verifica
- Rebuild → aprire `/v2/explore/network`:
  - Cliccare bandiera → appare chip paese con X → click X → chip sparisce e card riappare.
  - Cliccare città → chip search/città con X.
  - Combinare 2-3 filtri → rimuoverli uno alla volta in sequenza.
- Card aziendale: Mail/WhatsApp/Phone/LinkedIn/Web tutti allineati a sinistra sotto contatto principale, wrap pulito su pannelli stretti.
- Verificare anche `/v2/explore/contacts` (CRM usa stesso `EntityRow` + `ActiveFiltersBar`).

### Out of scope
- Nessuna modifica a logica filtri, query, DAL, hook globali.
- Nessun refactor dei badge nei sub-component (ContactSubCard ecc.) se già allineati.
