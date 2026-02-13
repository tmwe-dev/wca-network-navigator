

# Filtri Ranking ATECO nei Filtri Avanzati

## Obiettivo
Aggiungere nel pannello Filtri Avanzati (sotto l'AtecoGrid, a sinistra) dei selettori per filtrare le categorie ATECO visibili nell'albero in base ai parametri di ranking: Volume, Valore, Internazionalita, Probabilita di Pagamento e Score complessivo.

## Cosa cambia per l'utente
- Nei Filtri Avanzati appare una nuova sezione "Ranking ATECO" con 5 controlli:
  - **Volume minimo** (1-5 stelle): slider o selettore stelle
  - **Valore/kg minimo** (1-5 stelle): slider o selettore stelle
  - **Internazionalita**: multi-select tra MOLTO ALTO, ALTO, MEDIO, BASSO
  - **Probabilita pagamento**: multi-select tra SI - ALTA, SI - MEDIA, POSSIBILE
  - **Score minimo**: slider 0-20
- L'AtecoGrid nasconde automaticamente le sezioni/divisioni/gruppi che non raggiungono i criteri selezionati
- I conteggi si aggiornano di conseguenza

## Dettagli tecnici

### 1. Estendere `ProspectFilters` in `ProspectAdvancedFilters.tsx`
Aggiungere i nuovi campi all'interfaccia e a `EMPTY_FILTERS`:
- `rank_volume_min: number` (0 = disattivo, 1-5)
- `rank_valore_min: number` (0 = disattivo, 1-5)
- `rank_intl: string[]` (es. `["MOLTO ALTO", "ALTO"]`)
- `rank_paga: string[]` (es. `["SI - ALTA PROBABILITA"]`)
- `rank_score_min: number` (0 = disattivo)

### 2. Aggiungere i controlli UI in `ProspectAdvancedFilters.tsx`
- Sezione "Ranking ATECO" con:
  - Due righe con stelline cliccabili (1-5) per Volume e Valore
  - Due multi-select compatti per Internazionalita e Pagamento
  - Uno slider per Score minimo (0-20)

### 3. Modificare `AtecoGrid.tsx` per applicare i filtri ranking
- Ricevere `advFilters` come prop (o solo i campi ranking)
- Prima di renderizzare ogni sezione/divisione/gruppo, verificare se il suo ranking soddisfa i criteri
- Se un gruppo non passa i filtri, viene nascosto
- Se tutti i gruppi di una divisione sono nascosti, la divisione scompare
- Se tutte le divisioni di una sezione sono nascoste, la sezione scompare

### 4. Aggiornare `ProspectCenter.tsx`
- Passare `advFilters` (o i campi ranking) all'AtecoGrid come nuova prop

### File da modificare
- `src/components/prospects/ProspectAdvancedFilters.tsx` -- nuovi campi + UI ranking
- `src/components/prospects/AtecoGrid.tsx` -- filtraggio albero per ranking
- `src/pages/ProspectCenter.tsx` -- passare filtri ranking all'AtecoGrid

