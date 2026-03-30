

# Mostrare solo paesi con partner reali

## Problema
La griglia paesi usa la lista statica `WCA_COUNTRIES` (~200 paesi) e incrocia dati da `directory_cache` e `partners`. L'utente vuole vedere solo i paesi che hanno effettivamente partner nella tabella `partners`.

## Soluzione

**File: `src/components/download/CountryGrid.tsx`**

1. Rimuovere la dipendenza dalla query `directory_cache` (`get_directory_counts` RPC) — non serve piu come fonte primaria
2. Filtrare `WCA_COUNTRIES` mostrando solo quelli dove `stats[code]?.total_partners > 0` (dati che vengono gia da `useCountryStats` → `get_country_stats` RPC sulla tabella `partners`)
3. Rimuovere i filtri legati alla directory (`missing`, `directory`, `completion` come sort) che non hanno piu senso
4. Semplificare `getStatus` eliminando i confronti con `cacheData`
5. Il bottone "Sincronizza WCA" resta disponibile per i paesi selezionati

**Filtri che restano**: All, No Profilo, No Email, No Phone, No Deep Search
**Filtri rimossi**: Done/Todo/Missing (legati alla logica directory)

Nessuna modifica al database. Si usa solo `useCountryStats` che gia aggrega dalla tabella `partners`.

