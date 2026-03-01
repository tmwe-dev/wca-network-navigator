

## Piano: Operations — Layout Responsivo e Card Paese Compatte

### Problemi identificati
1. Senza selezione, `CountryGrid` occupa `w-full` → le card si allargano su tutta la pagina inutilmente
2. Nessun breakpoint responsive per mobile/tablet
3. Le stat pills nella top bar non si adattano a schermi piccoli

### Modifiche

**1. `src/pages/Operations.tsx`**
- Senza selezione: limitare la larghezza della CountryGrid con `max-w-[520px]` e usare una griglia a 2 colonne per le country card (non una singola colonna che si estende su tutto lo schermo)
- Con selezione: mantenere il layout attuale (CountryGrid `w-[260px]` + PartnerList a destra)
- Mobile (`< md`): layout verticale — CountryGrid in alto (compatta, max-h limitata e scrollabile), PartnerList sotto
- Top bar: nascondere le stat pills su mobile, mostrare solo titolo + azioni essenziali; su tablet wrappare le pills

**2. `src/components/download/CountryGrid.tsx`**
- Supportare un layout a griglia (`grid grid-cols-2`) quando lo spazio è ampio (senza selezione) per mostrare le card in colonne affiancate invece che una lista lunga
- Aggiungere prop `compact?: boolean` per forzare il layout a colonna singola quando la grid è nel sidebar stretto (260px)

**3. Dettaglio responsivo**
- `< 768px` (mobile): tutto stacked verticale, CountryGrid con altezza limitata `max-h-[40vh]`, PartnerList e Detail sotto
- `768-1024px` (tablet): layout a 2 colonne come ora ma CountryGrid `w-[220px]`
- `> 1024px`: come attuale ma CountryGrid senza selezione usa griglia a 2 colonne con `max-w-[520px]`

### Flusso risultante
- Apertura pagina: country cards compatte in griglia 2 colonne, centrate, non allungate su tutta pagina
- Click su un paese: griglia si riduce a sidebar 260px, partner list appare a destra
- Su mobile: tutto in colonna, scrollabile

