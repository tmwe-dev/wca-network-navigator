

## Ristrutturazione Completa del Prospect Center

### Problemi attuali

1. **Dropdown bloccati**: I `ScrollArea` dentro i `CommandList` non scorrono perche' hanno `max-h-48`/`max-h-56` troppo piccoli e il `CommandList` non ha un'altezza fissa — serve usare `className="max-h-[300px] overflow-auto"` direttamente sul `CommandList` senza `ScrollArea` annidato.

2. **Struttura ATECO piatta**: Attualmente l'AtecoGrid mostra le categorie raggruppate per prime 2 cifre ma in modo piatto, senza la struttura a cartelle espandibili (sezione lettera > divisione 2 cifre > gruppo 3 cifre).

3. **Layout sbagliato**: Il pannello sinistro contiene filtri regione/provincia nei dropdown, ma dovrebbe contenere l'albero ATECO navigabile. Il pannello destro mostra la lista prospect ma dovrebbe replicare il modello dell'Operations Center con tab (Prospect, Importa/Scarica) e il canvas di stato dei job.

### Nuova architettura (modello Operations Center)

```text
+--------------------------------------------------------------------+
|  Prospect Center               [Report Aziende]    [RASession] [T] |
|  [Stats bar: Totale | Email | PEC | Telefoni | Fatturato | ATECO]  |
+--------------------------------------------------------------------+
|  35% ALBERO ATECO              | 65% PANNELLO CONTESTUALE          |
|  [Cerca ATECO...] [Filtri]     | [header ATECO selezionati]        |
|                                | [Prospect] [Importa]              |
|  v A - AGRICOLTURA             | ┌────────────────────────────────┐|
|    v 01 - Produzioni veg...    | │ Lista prospect (come Partner   │|
|      > 01.1 - Coltivaz...      | │ Hub): nome, citta', fatturato, │|
|      > 01.2 - Colture perm     | │ email, telefono, responsabile, │|
|    > 02 - Silvicoltura         | │ rating, dipendenti, crescita   │|
|    > 03 - Pesca                | │                                │|
|  > B - ATTIVITA ESTRATTIVE     | │ Click => dettaglio inline      │|
|  v C - MANIFATTURIERE          | │                                │|
|    v 10 - Alimentari           | │ Tab Importa => ProspectImporter│|
|      ...                       | │ con status job trasparente     │|
|                                | └────────────────────────────────┘|
+--------------------------------------------------------------------+
```

### Modifiche dettagliate

#### 1. `src/components/prospects/AtecoGrid.tsx` — Riscrittura completa

**Struttura ad albero espandibile** usando i dati statici di `ATECO_TREE`:
- **Livello 1** (lettere A-U): sezioni principali, cliccabili per espandere
- **Livello 2** (2 cifre: 01, 02...): divisioni, cliccabili per espandere
- **Livello 3** (3 cifre: 01.1, 01.2...): gruppi, selezionabili

Ogni nodo mostra: icona cartella (aperta/chiusa), codice, descrizione troncata. I nodi selezionabili hanno checkbox. Selezionare una sezione o divisione seleziona tutti i figli.

I filtri Regione/Provincia restano nel dropdown del pulsante filtri (come ora), ma con i dropdown corretti (senza ScrollArea annidato, con `max-h-[300px] overflow-auto` sul `CommandList`).

L'albero e' costruito dal dato statico `ATECO_TREE` (370 voci), arricchito con i conteggi dal database tramite `useAtecoGroups`.

#### 2. `src/components/prospects/ProspectListPanel.tsx` — Allineamento al PartnerListPanel

Replicare la struttura del `PartnerListPanel` dell'Operations Center:
- Card prospect con: nome azienda (titolo principale), citta' + provincia, fatturato in evidenza, indicatori contatto (email, PEC, telefono con icone colorate), dipendenti, responsabile (dal primo contatto in `prospect_contacts`), rating affidabilita'
- Dettaglio inline con sezioni espanse: Anagrafica, Contatti Aziendali, Dati Finanziari, Management (da `prospect_contacts`), dati ATECO

#### 3. `src/pages/ProspectCenter.tsx` — Allineamento al layout Operations

Replicare esattamente la struttura di `Operations.tsx`:
- Quando nessun ATECO selezionato: empty state con icona + istruzioni
- Quando ATECO selezionati: header con label dei selezionati + TabsList (Prospect, Importa) nel header
- Tab "Prospect": ProspectListPanel
- Tab "Importa": ProspectImporter (con status dei job)
- ActiveJobBar equivalente per RA (opzionale, se c'e' uno scraping in corso)

#### 4. Fix dropdown scroll globale

In tutti i `MultiSelectPopover` (sia in AtecoGrid che in ProspectImporter): rimuovere `ScrollArea` annidato dentro `CommandList` e usare `className="max-h-[300px] overflow-auto"` direttamente su `CommandList`. Questo risolve il problema dello scroll bloccato.

### File da modificare

1. **`src/components/prospects/AtecoGrid.tsx`** — Riscrittura con albero espandibile a cartelle (Collapsible), fix scroll dropdown
2. **`src/components/prospects/ProspectListPanel.tsx`** — Allineamento card al modello PartnerListPanel con piu' dati
3. **`src/pages/ProspectCenter.tsx`** — Ristrutturazione layout come Operations.tsx (header con tab, ActiveJobBar)
4. **`src/components/prospects/ProspectImporter.tsx`** — Fix scroll nei dropdown MultiSelectPopover

### Dettaglio tecnico albero ATECO

L'albero viene costruito cosi':
- Dalle 370 voci di `ATECO_TREE` si estraggono i 3 livelli
- I conteggi dal database (`useAtecoGroups`) vengono mappati sui nodi foglia
- I conteggi dei nodi padre sono la somma dei figli
- Ogni nodo usa `Collapsible` di Radix per l'espansione
- Click sulla checkbox seleziona/deseleziona; click sulla cartella espande/comprime
- Selezionare un padre seleziona tutti i codici ATECO figli presenti nel database

