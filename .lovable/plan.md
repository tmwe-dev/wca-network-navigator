
# Fix: Paginazione Directory e Distinzione HQ/Branch

## Problema 1: La scansione si ferma troppo presto

La scansione degli Stati Uniti si e fermata alla pagina 3 (150 membri trovati), ma in realta ce ne sono molti di piu. Il motivo:

- Il sistema si affida al LLM di Firecrawl per estrarre i dati di paginazione (`total_results`, `total_pages`, `has_next_page`)
- Il LLM ha restituito `total_results: 47` e `total_pages: 1` — dati completamente sbagliati
- Con `total_pages: 1`, la formula `has_next_page = currentPage(3) < totalPages(1)` = `false`, quindi la scansione si ferma

**Soluzione**: Non fidarsi del LLM per la paginazione. Usare un approccio deterministico:
- Se una pagina restituisce esattamente `pageSize` (50) membri, c'e sicuramente una pagina successiva
- Fermarsi solo quando una pagina restituisce meno di `pageSize` membri (o zero)
- Mantenere i dati del LLM (`total_results`, `total_pages`) solo come informazione indicativa, mai come criterio di stop

## Problema 2: Branch Office vs Headquarter

La directory WCA di un paese include sia gli headquarter di aziende locali che le filiali (branch) di aziende di altri paesi. Il sistema gia estrae `office_type` ("head_office" o "branch") quando scarica il profilo dettagliato di ogni partner, ma nella fase di scansione directory questa distinzione non e visibile.

**Soluzione**: Dopo il download dei profili, mostrare nella UI quanti sono HQ e quanti branch per dare consapevolezza all'utente.

---

## Dettagli Tecnici

### File: `supabase/functions/scrape-wca-directory/index.ts`

Cambiare la logica di paginazione (linee 145-148):

```text
// PRIMA (inaffidabile - si affida al LLM):
const totalResults = extracted.total_results || members.length
const totalPages = extracted.total_pages || Math.ceil(totalResults / size) || 1
const hasNextPage = extracted.has_next_page ?? (currentPage < totalPages)

// DOPO (deterministico):
const totalResults = extracted.total_results || members.length
const totalPages = extracted.total_pages || Math.ceil(totalResults / size) || 1
// Regola deterministica: se abbiamo ricevuto esattamente pageSize risultati,
// quasi sicuramente c'e un'altra pagina
const hasNextPage = members.length >= size
```

Il valore `totalResults` e `totalPages` dal LLM vengono ancora restituiti come informazione indicativa, ma `has_next_page` si basa solo sul numero di risultati effettivamente ricevuti.

### File: `src/pages/DownloadManagement.tsx`

**DirectoryScanner** — aggiungere sicurezza anche lato client (linea ~838):

Anche nel loop del client, aggiungere un fallback: se `members.length >= pageSize` ma `has_next_page` e `false`, forzare il continuo. Questo come doppia sicurezza nel caso il backend non venga aggiornato.

```text
// Doppia sicurezza: se la pagina ha restituito 50 risultati,
// continua anche se il server dice has_next_page: false
hasNext = result.pagination.has_next_page || result.members.length >= 50;
```

**PickCountry** — aggiungere conteggio HQ/Branch nei badge paese:

Nella query che conta i partner per paese, aggiungere il breakdown per `office_type`. Mostrare nelle card qualcosa come "150 (120 HQ + 30 Branch)" per dare all'utente piena visibilita.

- Query aggiuntiva: raggruppare per `office_type` nella stessa query partner per paese
- Badge aggiuntivo nelle card paese: mostrare il rapporto HQ/Branch sotto il conteggio totale
