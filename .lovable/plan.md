

## Piano: Mostrare tutti gli 11.000 contatti con gruppi e contatori completi

### Problema principale

Il sistema carica solo 200 contatti per pagina e costruisce i gruppi client-side da quei 200. Con 11.000 record, l'utente vede solo i gruppi presenti nei primi 200 contatti — non tutti i paesi, origini o status reali.

### Soluzione: gruppi dal database + caricamento on-demand

**1. Nuova RPC `get_contact_group_counts`** — restituisce i conteggi per TUTTI i contatti nel database, raggruppati per paese, origine, status e mese. Una singola chiamata SQL che bypassa il limite di 1000 righe.

```sql
CREATE OR REPLACE FUNCTION get_contact_group_counts()
RETURNS TABLE (
  group_type text,
  group_key text,
  group_label text,
  contact_count bigint,
  with_email bigint,
  with_phone bigint,
  with_deep_search bigint,
  with_alias bigint
)
```

Restituisce righe come:
- `("country", "Italy", "Italy", 2450, 1800, 900, 120, 50)`
- `("origin", "Cosmoprof", "Cosmoprof", 340, 200, 100, 0, 0)`
- `("status", "new", "new", 8000, ...)`

**2. Riscrittura della logica gruppi nel `ContactListPanel`**

- Le **strisce dei gruppi** vengono dalla RPC (tutti i gruppi, tutti i conteggi reali)
- Quando l'utente **espande un gruppo**, viene fatta una query filtrata per quel valore specifico (es. `country = "Italy"`) con paginazione interna al gruppo
- Nessun limite artificiale di 200 — l'utente vede TUTTI i gruppi nell'elenco

**3. Contatori nei dropdown filtri**

La stessa RPC fornisce i dati per mostrare i conteggi nelle opzioni dei dropdown Paese, Origine e Status:
- `Italy (2450)`, `Germany (890)`, etc.

**4. Icone al posto del dropdown "Raggruppa per"**

Sostituire il Select "Raggruppa per" con 4 icone toggle (Globe, MapPin, Tag, Calendar) come da piano precedente approvato.

### File da modificare

| File | Modifica |
|------|----------|
| DB Migration | Nuova RPC `get_contact_group_counts` |
| `src/hooks/useContacts.ts` | Nuovo hook `useContactGroupCounts()` + hook `useContactsByGroup(groupType, groupKey, page)` per caricamento on-demand |
| `src/components/contacts/ContactListPanel.tsx` | Strisce da RPC, espansione carica contatti filtrati, paginazione per gruppo |
| `src/components/contacts/ContactFiltersBar.tsx` | 4 icone toggle per raggruppamento + conteggi nei dropdown |

### Flusso utente risultante

1. Apre la pagina Contatti → vede TUTTE le strisce (es. 45 paesi) con conteggi reali
2. Clicca "Italy (2450)" → carica i primi 200 contatti italiani
3. Scorre → paginazione interna al gruppo
4. I dropdown mostrano `Italy (2450)`, `Cosmoprof (340)`, etc.

