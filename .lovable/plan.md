

## Diagnosi

Il problema e' nel calcolo di `idsToDownload` (riga 161-168 di `PartnerListPanel.tsx`). Quando la modalita' e' `no_profile`, il codice filtra `noProfileIds` attraverso `uniqueIds` (che proviene dalla directory cache). Se la directory cache e' vuota per l'Albania, `uniqueIds` e' vuoto, quindi `idsToDownload` risulta sempre 0 — il bottone mostra "SCARICA 0 PROFILI" ed e' disabilitato.

I partner esistono nel DB (li vedi nella lista), hanno WCA ID, ma mancano di `raw_profile_html`. Il sistema pero' pretende che quegli ID siano anche nella directory cache per poterli scaricare.

## Piano di fix

### File: `src/components/operations/PartnerListPanel.tsx`

**1. Fix `idsToDownload` memo (riga 161-168)**
- Modalita' `no_profile`: usare direttamente `noProfileIds` dal DB quando la directory cache e' vuota, senza filtrarli attraverso `uniqueIds`
- Modalita' `new`: invariata (dipende da directory cache per definizione)
- Modalita' `all`: fallback su WCA IDs dal DB quando cache vuota

```typescript
const idsToDownload = useMemo(() => {
  if (downloadMode === "all") {
    return uniqueIds.length > 0 ? uniqueIds : dbPartners.map(p => p.wca_id);
  }
  if (downloadMode === "no_profile") {
    // Use noProfileIds directly from DB — no dependency on directory cache
    if (uniqueIds.length > 0) {
      const existingNoProfile = uniqueIds.filter(id => noProfileWcaSet.has(id));
      return [...new Set([...missingIds, ...existingNoProfile])];
    }
    return noProfileIds; // ← fallback diretto dal DB
  }
  return missingIds;
}, [downloadMode, uniqueIds, missingIds, noProfileWcaSet, noProfileIds, dbPartners]);
```

**2. Auto-select `no_profile` mode quando non c'e' cache (riga 173-175)**
- Aggiungere condizione: se `hasCache === false` e `noProfileIds.length > 0`, forzare `downloadMode` a `no_profile`

**3. Fix contatori nel wizard**
- `totalCount` e `downloadedCount` (righe 355-356) usano `uniqueIds` che dipende dalla cache. Quando cache vuota, mostra "0 WCA / 0 Scaricati" — fuorviante. Aggiungere fallback su `stats.total` e `stats.withProfile`.

