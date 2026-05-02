## Principio

Le sidebar (filter rail) sono **solo filtri**. Tutti gli ordinamenti vivono **nella toolbar sopra la lista** della pagina, dove l'utente vede subito l'effetto del cambio.

## Cosa cambio

### 1. Rimuovo le sezioni "Ordina" da TUTTE le sidebar

File toccati (rimuovo solo il blocco `<FilterSection ... label="Ordina*">` e i relativi import inutilizzati):

- `NetworkFiltersSection.tsx` — rimuovo "Ordina partner" (dropdown + A↔Z)
- `CRMFiltersSection.tsx` — rimuovo "Ordina contatti"
- `CockpitFiltersSection.tsx` — rimuovo "Ordina"
- `AttivitaFiltersSection.tsx` — rimuovo "Ordina"
- `AgendaFiltersSection.tsx` — rimuovo "Ordina"
- `CircuitFiltersSection.tsx` — rimuovo "Ordina"
- `SortingFiltersSection.tsx` — rimuovo "Ordina"
- `InboxFiltersSection.tsx` — rimuovo "Ordina" (sia EMAIL_SORT sia i chip date_desc/date_asc/unread)
- `EmailIntelligenceFiltersSection.tsx` — rimuovo "Ordina"
- `CampaignsFiltersSection.tsx` — rimuovo "Ordina"
- `NetworkFilterSlot.tsx` (legacy slot) — rimuovo il blocco Sort

### 2. Aggiorno il counter dei filtri attivi

In `useFiltersDrawerState.ts` rimuovo i conteggi che incrementano `n` per `sortBy/networkSort/emailSort/emailIntelSort` ≠ default. L'ordinamento non è più un "filtro attivo".
Mantengo i `setNetworkSort/setSortBy/...` nel reset solo per pulizia stato globale.

### 3. Network e Contacts: la toolbar resta sovrana

`NetworkPage` e `ContactsPage` hanno già `ListToolbar` con dropdown sort + direzione. Rimango invariati. In `NetworkPage` semplifico togliendo il `sortOverride` collegato alla sidebar (non più necessario): la toolbar usa il proprio stato locale `useSortedCompanies`.

### 4. Stato globale: NON tocco lo schema

`networkSort`, `networkSortDir`, `sortBy`, `emailSort`, `emailIntelSort` restano in `GlobalFiltersContext` perché alcune pagine non‑V2 li leggono ancora (`PartnerListPanel`, `EmailInboxView`, `manual-grouping/useFilterAndSort`). Restano valorizzati ai default; le pagine consumatrici continueranno a funzionare finché non aggiungeremo le rispettive toolbar (lavoro futuro, come da risposta dell'utente).

### 5. Toolbar mancanti — fuori scope

Per Inbox, Email Intelligence, Cockpit, Attività, Agenda, Circuit, Sorting, Campaigns, BCA aggiungeremo una toolbar con sort dropdown **in un secondo passaggio**, pagina per pagina, quando ci lavoreremo. Per ora: nessuna UI di ordinamento (lo stato ricade sul default già in `GlobalFiltersContext`).

## Risultato per l'utente

- Le sidebar diventano più corte e coerenti: solo filtri (paesi, qualità, stato, canale, ricerca…).
- Network e CRM continuano ad ordinare via la toolbar in cima alla lista.
- Le altre pagine usano l'ordinamento di default finché non aggiungeremo la loro toolbar.

## Note tecniche

- Solo modifiche frontend/presentation.
- Nessuna migrazione DB, nessun cambio business logic.
- Nessuna rimozione di setter/state nel context (evita rotture nei consumer legacy).
