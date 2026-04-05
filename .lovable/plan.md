

# Piano: Eliminare duplicazione filtri Network — tutto nella FiltersDrawer

## Problema

Nella pagina Network ci sono **3 livelli di filtri sovrapposti**:

1. **VerticalTabNav** (sidebar interna) con `NetworkFilterSlot` — contiene Cerca, Ordina, Qualità Dati
2. **CountryGrid** (colonna sinistra nel contenuto) — lista paesi con conteggi, occupa 220-280px
3. **FiltersDrawer** (linguetta lilla sinistra) — contiene gli stessi filtri duplicati

L'utente ha stabilito che **tutti i filtri e ordinamenti devono stare SOLO nella FiltersDrawer** (linguetta lilla). La parte interna della pagina deve mostrare solo i dati.

## Soluzione

### 1. Rimuovere VerticalTabNav dalla pagina Network

`Network.tsx` non usa più `VerticalTabNav` + `NetworkFilterSlot`. Il toggle Partner/BCA è già nell'header globale (HeaderBarPortal). La pagina diventa un semplice wrapper che passa la view a Operations.

### 2. Spostare CountryGrid dentro FiltersDrawer

La lista paesi con flag e conteggi viene integrata nella sezione Network del `FiltersDrawer.tsx`. Quando l'utente seleziona paesi nel drawer, il filtro si applica alla vista principale. La colonna sinistra dei paesi sparisce dalla pagina.

### 3. Semplificare layout Operations (vista Partner)

Il layout diventa a **2 colonne** (non 3):
- **Colonna 1**: Lista partner (tutta la larghezza se nessun dettaglio aperto)
- **Colonna 2**: Dettaglio partner (quando selezionato)

Senza CountryGrid e senza la necessità di selezionare un paese prima: la lista mostra tutti i partner, filtrabili dal FiltersDrawer.

### 4. FiltersDrawer — sezione Network potenziata

La sezione Network nel FiltersDrawer includerà:
- Cerca partner
- Ordina (Nome, Paese, N° contatti, Più recenti)
- **Lista paesi** (con flag, conteggi, selezione multipla) — migrata da CountryGrid
- Qualità dati (Con email, Con tel, Con profilo, Senza email, Senza contatti)
- Filtro Directory Only (toggle)
- Pulsante Sincronizza WCA

### File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Network.tsx` | Rimuovere VerticalTabNav e NetworkFilterSlot, layout semplificato |
| `src/pages/Operations.tsx` | Rimuovere CountryGrid dalla colonna 1, layout 2 colonne, mostrare tutti i partner senza selezione paese obbligatoria |
| `src/components/global/FiltersDrawer.tsx` | Aggiungere CountryGrid compatta nella sezione Network con selezione paesi |
| `src/contexts/GlobalFiltersContext.tsx` | Aggiungere stato `selectedCountries` se non già presente per condividerlo tra FiltersDrawer e Operations |

