
## Ristrutturazione Colonna Paesi - Operations Center

### Modifiche richieste

**1. Layout griglia: da 3 colonne a 1 colonna**
- Cambio da `grid grid-cols-2 lg:grid-cols-3` a lista verticale a colonna singola
- Ogni card paese occupa tutta la larghezza della colonna, piu' leggibile e dettagliata
- Piu' spazio per mostrare nome completo, statistiche e barra progresso

**2. Barra di ricerca: grande e centrata**
- Input "Cerca paese" allargato a tutta la larghezza della colonna
- Font piu' grande, altezza aumentata (h-11), padding generoso
- Icona di ricerca piu' visibile

**3. Filtri e ordinamento in un dropdown unico**
- Rimozione dei filtri inline (Tutti/Scansionati/Parziali/Mai esplorati) e del selettore ordinamento dalla toolbar visibile
- Creazione di un unico pulsante dropdown (Popover o DropdownMenu) accanto alla barra di ricerca
- Dentro il dropdown: sezione ordinamento (Nome A-Z, N. partner, Completamento) + sezione filtri (Tutti, Scansionati, Parziali, Mai esplorati) con conteggi
- Il pulsante dropdown mostra un'icona filtro + indicatore del filtro attivo

**4. Badge paesi selezionati: solo bandiere grandi**
- Rimozione del testo nome paese dai badge
- Bandiere piu' grandi (text-2xl o text-3xl) affiancate orizzontalmente
- Click sulla bandiera per deselezionare (con X piccola al hover)
- Layout compatto: bandiere una accanto all'altra senza testo

**5. Card paese: design moderno con tinta di colore**
- Sfondo con gradiente o tinta unita invece di bianco/trasparente
- Colori basati sullo stato: verde-teal per completi, ambra per parziali, slate per non esplorati, sky per selezionati
- Bordi arrotondati, ombra leggera, hover con glow piu' pronunciato
- Stripe laterale piu' spessa e visibile

### Dettagli Tecnici

**File modificato**: `src/components/download/CountryGrid.tsx`

Modifiche specifiche:
- Linea 212: `grid grid-cols-2 lg:grid-cols-3` diventa `flex flex-col` (colonna singola)
- Linee 119-183: Toolbar ristrutturata — input largo + dropdown unico con Popover
- Linee 186-208: Badge semplificati a sole bandiere grandi senza testo
- Linee 236-345: Card paese con sfondo a tinta/gradiente colorato, non bianco trasparente

Nessuna modifica alla logica di business, solo presentazione visuale.
