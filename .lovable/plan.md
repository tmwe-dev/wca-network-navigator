

# Piano: Eliminare COL 3 Placeholder e Integrare il Tasto Conferma

## Problema

Nello step 0 (selezione paesi), la terza colonna e' uno spreco enorme di spazio: serve solo a mostrare un tasto "Conferma e prosegui" con delle bandierine. E' inutile e brutto.

## Soluzione

1. **Eliminare COL 3 dallo step 0** -- Lo step 0 diventa solo 2 colonne: Stats sidebar + Country Grid. Occupano tutto lo spazio disponibile.

2. **Tasto "Conferma" sopra la stats sidebar** -- Quando ci sono paesi selezionati, un bottone compatto appare in cima alla colonna Stats (o in cima alla CountryGrid), con le bandierine dei paesi e il tasto di conferma. Nessuna colonna dedicata.

3. **ActiveJobBar / Terminal / JobMonitor** -- Questi restano visibili ma spostati sotto la CountryGrid (oppure in un banner compatto nell'header) quando ci sono job attivi, senza sprecare una colonna intera.

4. **Placeholder "Seleziona un paese"** -- Eliminato completamente. La CountryGrid stessa e' gia' auto-esplicativa.

## Dettaglio Tecnico -- `Operations.tsx`

### Step 0: Layout a 2 colonne

```text
┌─────────────┬────────────────────────────────────┐
│ Stats       │ Country Grid                       │
│ sidebar     │ (filtri, lista paesi scrollabile)   │
│             │                                    │
│ [Conferma →]│ ActiveJobBar (se job attivi)        │
│ (quando     │ DownloadTerminal (se job attivi)    │
│ selezionati)│ JobMonitor (se job attivi)          │
└─────────────┴────────────────────────────────────┘
```

- La stats sidebar ha in basso (o in cima) il bottone conferma che appare solo se `selectedCountries.length > 0`
- La CountryGrid si espande per prendere tutto il resto dello spazio
- ActiveJobBar/Terminal/JobMonitor appaiono sotto la grid solo se ci sono job attivi

### Step 1: invariato (Detail 40% + PartnerList 60%)

Nessun cambiamento allo step 1, funziona gia'.

### Modifiche specifiche

**Rimuovere** (righe ~269-317): L'intera COL 3 dello step 0 con il placeholder e il bottone conferma.

**Aggiungere** nella stats sidebar (COL 1): Un bottone "Conferma" compatto in fondo alla colonna, visibile solo quando `selectedCountries.length > 0`. Mostra le bandierine e il conteggio.

**Spostare** ActiveJobBar/Terminal/JobMonitor: Da COL 3 a sotto la CountryGrid (nella stessa COL 2, in fondo), visibili solo se ci sono job attivi.

**Aggiustare larghezze**: Step 0 usa 2 colonne che occupano il 100% dello spazio (stats ~140px + grid flex-1).

## File modificati

1. **`src/pages/Operations.tsx`** -- Rimozione COL 3 dallo step 0, bottone conferma nella stats sidebar, spostamento job monitors

