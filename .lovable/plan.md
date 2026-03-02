

## Diagnosi: 69 vs 44 partner e problemi post-refactoring

### Bug confermato: limite query di 1000 righe

Il database contiene **1554 partner attivi**. La query `usePartners({})` in `PartnerHub.tsx` usa `.limit(2000)`, ma il server limita le risposte a **1000 righe** (configurazione PostgREST `max-rows`).

Verifica matematica: 1000/1554 × 69 = **44.4 ≈ 44** — esattamente il numero che vedi.

`CountryCards` usa `useCountryStats()` (funzione SQL server-side, nessun limite) → mostra 69.  
`CountryWorkbench` filtra client-side dai 1000 partner ricevuti → mostra solo 44 su 69.

La pagina Operations **non ha questo bug** perché `PartnerListPanel` già filtra per paese nella query: `usePartners({ countries: countryCodes })`.

### Correzione

**File: `src/pages/PartnerHub.tsx`**

Aggiungere il filtro paese a `mergedFilters` quando siamo nella vista "country":

```typescript
const mergedFilters: PartnerFilters = {
  ...filters,
  search: search.length >= 2 ? search : undefined,
  // Quando in vista paese, filtra server-side per il paese selezionato
  countries: viewLevel === "country" && selectedCountry
    ? [selectedCountry]
    : filters.countries,
};
```

Questo riduce la query da 1554 a ~69 righe per ZA, ben sotto qualsiasi limite.

### Stato dei pulsanti (Deep Search, Workspace, Email)

I pulsanti nella `BulkActionBar` del Partner Hub sono correttamente collegati. Non sono stati toccati dal refactoring — le funzioni `handleBulkDeepSearch`, `handleSendToWorkspace`, `handleBulkEmail` sono tutte presenti e funzionanti. Posso verificare con un test dopo la correzione.

### Canvas

I Canvas (Download e Deep Search) esistono **solo nella pagina Operations**, non nel Partner Hub. Nel Partner Hub la Deep Search usa un loop locale senza canvas visuale — questo è il design originale, non un bug del refactoring.

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| `src/pages/PartnerHub.tsx` | Aggiungere filtro paese a `mergedFilters` (1 riga) |

