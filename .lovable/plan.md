

## Piano: Assistente AI nella maschera Contatti

### Obiettivo
Aggiungere un campo di ricerca AI nella `ContactFiltersBar` che permetta all'utente di dare comandi in linguaggio naturale. L'agente AI può filtrare, ordinare, selezionare contatti, avviare Deep Search, generare alias, creare attività e campaign jobs — tutto dalla stessa interfaccia.

### Architettura

Il sistema segue lo stesso pattern dell'`ai-assistant` e `import-assistant` già esistenti: edge function con tool-calling + componente frontend.

**Differenza chiave**: l'AI non risponde solo con testo, ma restituisce **comandi strutturati** che il frontend applica direttamente (filtri, ordinamento, selezione). L'utente vede il risultato e conferma.

### 1. Edge Function: `supabase/functions/contacts-assistant/index.ts`

**System prompt**: Agente specializzato sulla tabella `imported_contacts`. Riceve come contesto i filtri attivi, il numero di contatti visibili, i gruppi aperti.

**Tools disponibili**:

| Tool | Descrizione |
|------|-------------|
| `search_contacts` | Cerca contatti per azienda, nome, email, paese, città, origine, status |
| `count_contacts` | Conteggio con filtri |
| `set_filters` | Imposta filtri (paese, origine, status, holdingPattern, dateFrom/dateTo, search, groupBy) — ritorna JSON che il frontend applica |
| `set_sort` | Imposta ordinamento (company, name, city, date) |
| `select_contacts` | Seleziona contatti per criterio (paese, origine, tutti, gruppo specifico) |
| `update_lead_status` | Aggiorna lo status di contatti selezionati o filtrati |
| `create_activities` | Crea attività (email/call) per contatti selezionati |
| `get_contact_stats` | Statistiche: conteggi per paese, origine, status, email/phone coverage |

**Risposta strutturata**: L'AI appende un delimitatore `---COMMAND---` con un JSON di azioni da eseguire:
```json
{
  "type": "apply_filters",
  "filters": { "country": "Italy", "holdingPattern": "out" },
  "sort": "company",
  "message": "Ho filtrato per Italia, contatti non ancora nel circuito"
}
```

### 2. Componente: `src/components/contacts/ContactAIBar.tsx`

Un campo input integrato nella `ContactFiltersBar` (sotto la riga di ricerca) con:
- Icona `Bot` + placeholder "Chiedi all'AI di filtrare, ordinare, selezionare..."
- Invio con Enter o pulsante Send
- Stato loading con spinner
- Risposta breve dell'AI mostrata inline sotto il campo (collapsibile)
- I comandi strutturati vengono passati al parent via callback `onAICommand`

### 3. Modifiche a `ContactListPanel.tsx`

- Passare `onAICommand` callback alla `ContactFiltersBar` → `ContactAIBar`
- Il callback applica: `setFilters()`, `setSortKey()`, `selection.addBatch()` ecc.
- Invalidare query dopo azioni mutative (update status, create activities)

### 4. Modifiche a `ContactFiltersBar.tsx`

- Aggiungere `ContactAIBar` come nuova riga (Row 0, prima di tutto)
- Passare callback `onAICommand` e contesto corrente (filtri attivi, conteggi)

### Flusso utente

1. Utente scrive: "Mostrami tutti i contatti dalla Germania senza interazioni"
2. AI chiama `set_filters` → `{ country: "Germany", holdingPattern: "out" }`
3. Frontend riceve il comando, applica i filtri, mostra conferma inline
4. Utente scrive: "Selezionali tutti e avvia una campagna email"
5. AI chiama `select_contacts` + `create_activities` → frontend seleziona + conferma

### File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/contacts-assistant/index.ts` | Creare — edge function con tools |
| `src/components/contacts/ContactAIBar.tsx` | Creare — campo input AI inline |
| `src/components/contacts/ContactFiltersBar.tsx` | Modificare — aggiungere ContactAIBar |
| `src/components/contacts/ContactListPanel.tsx` | Modificare — gestire comandi AI |
| `supabase/config.toml` | Aggiungere config per la nuova function |

