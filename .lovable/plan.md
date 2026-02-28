

## Piano: Pagina Sorting — Area di controllo e invio job

### Concetto

Una nuova pagina `/sorting` che funge da "dogana" per tutti i job (email, chiamate) creati altrove. L'utente rivede ogni messaggio prima di autorizzarne l'invio, singolarmente o in batch.

### Modello dati

Aggiungere colonne alla tabella `activities` esistente (migrazione):

```sql
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
```

- `email_subject` / `email_body`: il messaggio generato al momento della creazione del job
- `scheduled_at`: data/ora programmata per l'invio
- `reviewed`: flag che indica che l'utente ha controllato il contenuto
- `sent_at`: timestamp di invio effettivo

Nessuna nuova tabella. Le activities con `status = 'pending'` e `email_body IS NOT NULL` sono quelle in attesa nella Sorting.

### Pagina `/sorting` — Layout a due colonne

**Sinistra (40%)** — `SortingList.tsx`:
- Query: `activities` filtrate per `status = 'pending'`, `email_body IS NOT NULL`, ordinate per `scheduled_at`
- Raggruppate per paese (bandiera + nome)
- Ogni riga mostra: checkbox, nome azienda (alias), nome contatto (alias), email, orario programmato, badge "Rivisto" verde se `reviewed = true`
- Barra toolbar in alto: filtri (Tutti / Da rivedere / Rivisti / Programmati oggi), ricerca, selezione rapida (Tutti, Nessuno)
- Contatore: "12 in coda · 5 rivisti · 3 programmati oggi"

**Destra (60%)** — `SortingCanvas.tsx`:
- Mostra il dettaglio del job selezionato
- Header: azienda, paese, contatto, email destinatario
- Body: anteprima email (subject + body HTML) in un riquadro stilizzato come email
- Bottoni azione:
  - **Approva** (segna `reviewed = true`)
  - **Modifica** (apre editor inline del body)
  - **Invia ora** (chiama edge function `send-email`, setta `sent_at` e `status = 'completed'`)
  - **Scarta** (setta `status = 'cancelled'`)
- Senza selezione: placeholder "Seleziona un job dalla lista"

**Barra azioni batch** (bottom bar, visibile quando selezione > 0):
- "Approva selezionati" → bulk update `reviewed = true`
- "Invia selezionati" → solo quelli con `reviewed = true`, invio sequenziale con progress bar
- "Scarta selezionati" → bulk `status = 'cancelled'`

### Flusso di creazione job (upstream)

Quando il Workspace genera un'email, salvare `email_subject` e `email_body` nell'activity corrispondente + impostare `scheduled_at`. L'activity appare automaticamente nella Sorting.

### Navigazione

Aggiungere "Sorting" nella sidebar tra "Workspace" e "Agenda", con icona `PackageCheck` (lucide).

### File da creare/modificare

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiungere colonne `email_subject`, `email_body`, `scheduled_at`, `reviewed`, `sent_at` ad `activities` |
| `src/pages/Sorting.tsx` | Nuova pagina con layout a due colonne |
| `src/components/sorting/SortingList.tsx` | Lista job raggruppata per paese con checkbox e filtri |
| `src/components/sorting/SortingCanvas.tsx` | Anteprima email + azioni (approva/modifica/invia/scarta) |
| `src/hooks/useSortingJobs.ts` | Hook per query/mutazioni activities in coda sorting |
| `src/App.tsx` | Route `/sorting` |
| `src/components/layout/AppSidebar.tsx` | Voce "Sorting" nella nav |
| `src/pages/Workspace.tsx` | Salvare email generata nell'activity quando confermata |

