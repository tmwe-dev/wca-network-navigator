
# Card su 2 righe + Dropdown raggruppamento + Intestazione ordinabile + Filtri cliccabili inline

## Cosa cambia

### 1. ContactCard su 2 righe
La card attuale è una sola riga orizzontale con tutto compresso. Ristrutturazione su 2 righe:

```text
Riga 1: #42 □ 🇮🇹 A&G CHEMICAL PRODUC...   Mario Rossi · CEO         WCA OLD    [⚡][🔗]
Riga 2:           Osio Sotto · Italy        mario@acg.com              Cliente    ●3
```

- Riga 1: index, checkbox, bandiera, azienda (bold), nome contatto + posizione, origine, indicatori
- Riga 2: (indentata sotto la bandiera) città · paese, email troncata, lead status, contatore interazioni
- Altezza stimata card: ~68px (aggiornare `estimateSize` nel virtualizer)
- Tutti gli elementi allineati a sinistra con larghezze fisse per incolonnamento

### 2. Dropdown "Raggruppa per" al posto del bottone "Tutti"
Il bottone "Tutti (11428)" diventa un `<select>` / dropdown che permette di scegliere il tipo di raggruppamento:
- Paese (default)
- Origine
- Stato lead

Selezionando un raggruppamento, i tab orizzontali di fianco mostrano le voci di quel gruppo con conteggi. Questo usa `gf.groupBy` che già esiste nel context.

### 3. Riga intestazione ordinabile sopra la lista
Una riga header fissa tra i tab e la lista con le colonne cliccabili:

```text
[Azienda ↕] [Contatto ↕] [Città ↕] [Paese ↕] [Origine ↕]
```

Ogni click toglie ASC → DESC → nessun ordinamento. L'ordinamento viene passato come parametro `sort` alla query paginata (server-side).

### 4. Filtro inline cliccando su un valore
Quando l'utente clicca su un valore nella card (es. "Italy", "Milano", "WCA OLD"), quel valore viene aggiunto come filtro attivo. Stato locale `activeFilters: Array<{field, value}>`.

- I filtri attivi appaiono come chip in una barra sotto l'intestazione: `🇮🇹 Italy ✕` `Milano ✕`
- Ogni chip ha una X per rimuoverlo
- I filtri vengono combinati (AND) e passati alla query paginata
- Cliccando lo stesso valore due volte lo rimuove

### 5. Applicazione agli altri moduli (Network + sidebar)
Lo stesso pattern (intestazione ordinabile + filtro click su valore + chip attivi) verrà replicato in:
- `PartnerListPanel.tsx` (Network) — stessa logica
- `CRMContactNavigator` nella sidebar — versione compatta

Questo sarà un secondo step dopo il CRM.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactCard.tsx` | Layout 2 righe con elementi incolonnati; valori cliccabili che emettono evento filtro |
| `src/components/contacts/ContactListPanel.tsx` | Dropdown raggruppamento; riga intestazione ordinabile; barra chip filtri attivi; `estimateSize` → 68; stato `activeFilters` + logica addFilter/removeFilter; passare filtri alla query |
| `src/hooks/useContactsPaginated.ts` | Aggiungere supporto filtro `city` e ordinamento multi-colonna server-side |
| `src/components/operations/PartnerListPanel.tsx` | (Step 2) Replicare intestazione ordinabile + filtro click inline |
| `src/components/global/FiltersDrawer.tsx` | (Step 2) Stessa logica nella sidebar CRM navigator |

Nessuna migrazione DB.
