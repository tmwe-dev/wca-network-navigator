

## Audit Completo: Funzioni Clickabili nella Pagina Contatti (/contacts)

Ho analizzato ogni singolo elemento interattivo della pagina. Ecco l'inventario completo con lo stato di funzionamento.

---

### FILTER BAR (ContactFiltersBar)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 1 | **Campo Ricerca** | Filtra contatti per testo | OK nel codice | Il filtro `search` viene passato ma la RPC `get_contact_group_counts` potrebbe non usarlo -- i gruppi non si filtrano con la search |
| 2 | **Icona Globe** (Raggruppamento Paese) | Cambia groupBy a "country" | OK | Funziona |
| 3 | **Icona MapPin** (Raggruppamento Origine) | Cambia groupBy a "origin" | OK | Funziona |
| 4 | **Icona Tag** (Raggruppamento Status) | Cambia groupBy a "status" | OK | Funziona |
| 5 | **Icona Calendar** (Raggruppamento Data) | Cambia groupBy a "date" | OK | Funziona |
| 6 | **Toggle List** (Tutti) | holdingPattern = "all" | OK | Funziona |
| 7 | **Toggle Plane** (In circuito) | holdingPattern = "in" | OK | Funziona |
| 8 | **Toggle PlaneLanding** (Da lavorare) | holdingPattern = "out" | OK | Default attivo |
| 9 | **Sort Dropdown** | Cambia ordinamento (Azienda/Nome/Citta/Data) | OK | Funziona |
| 10 | **Bottone Filter** | Apre/chiude filtri avanzati | OK | Badge con conteggio filtri attivi presente |
| 11 | **Bottone Sparkles (AI)** | Apre/chiude AI Assistant | OK | Funziona |
| 12 | **Bottone X (Reset)** | Resetta tutti i filtri | OK | Appare solo se filtri attivi |
| 13 | **Dropdown Cestini Import** | Filtra per batch di importazione | OK | Funziona se ci sono importGroups |
| 14 | **Dropdown Paese** | Filtra per paese | OK | Mostra conteggi |
| 15 | **Dropdown Origine** | Filtra per origine | OK | Mostra conteggi |
| 16 | **Dropdown Status** | Filtra per lead status | OK | Mostra conteggi |
| 17 | **DatePicker "Dal"** | Filtra data inizio | OK | Con bottone X per cancellare |
| 18 | **DatePicker "Al"** | Filtra data fine | OK | Con bottone X per cancellare |

### AI BAR (ContactAIBar)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 19 | **Input AI + Send** | Invia query all'edge function `contacts-assistant` | RICHIEDE CREDITI | L'utente ha 0 crediti -- probabilmente fallira |
| 20 | **Toggle risposta** | Espande/comprime la risposta AI | OK | Funziona |

### GROUP STRIP (per ogni gruppo)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 21 | **Checkbox gruppo** | Seleziona/deseleziona tutti i contatti del gruppo | OK | Carica fino a 1000 ID |
| 22 | **Click nome gruppo** | Espande/comprime l'accordion | OK | Funziona |
| 23 | **Bottone Deep Search** (nel gruppo aperto) | Mostra solo un toast placeholder | **BUG** | Non fa nulla di reale -- mostra solo un toast informativo senza avviare alcun processo |
| 24 | **Bottone Alias** (nel gruppo aperto) | Genera alias per il gruppo | OK ma con problemi | Non mostra stato di loading nel bottone del GroupStrip; il bottone resta cliccabile durante il processing |

### CONTACT CARD (per ogni contatto)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 25 | **Click sulla card** | Seleziona contatto e mostra dettaglio | OK | Funziona |
| 26 | **Checkbox nella card** | Toggle selezione per azioni bulk | OK | Funziona con stopPropagation |

### PAGINAZIONE (ExpandedGroupContent)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 27 | **Freccia sinistra** | Pagina precedente | OK | Disabilitata a pagina 0 |
| 28 | **Freccia destra** | Pagina successiva | OK | Disabilitata all'ultima pagina |

### BULK ACTION BAR (appare quando selection.count > 0)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 29 | **Workspace** | Crea attivita email e naviga a /workspace | OK | Funziona con contatti che hanno email |
| 30 | **Job** | Crea campaign_jobs e naviga a /campaign-jobs | OK | Funziona, pulisce selezione dopo |
| 31 | **Deep Search** | Nessun onClick handler | **BUG** | Il bottone e puramente decorativo -- non ha alcun `onClick` |
| 32 | **Campagna** | Nessun onClick handler | **BUG** | Il bottone e puramente decorativo -- non ha alcun `onClick` |
| 33 | **X (chiudi selezione)** | Pulisce selezione e gruppi selezionati | OK | Funziona |

### DETAIL PANEL (pannello destro)

| # | Elemento | Azione | Stato | Problema |
|---|----------|--------|-------|----------|
| 34 | **Link Email** (mailto:) | Apre client email | OK | Funziona |
| 35 | **Link WhatsApp** | Apre wa.me con numero | OK | Solo se c'e mobile o phone |
| 36 | **Link Telefono** (tel:) | Apre dialer | OK | Funziona |
| 37 | **Genera Alias** | Invoca edge function generate-aliases | OK | Sparisce dopo generazione (justGenerated=true) |
| 38 | **Holding Pattern phases** (5 bottoni status) | Cambia lead_status del contatto | OK | Aggiorna DB + toast |
| 39 | **Toggle "Dettagli"** | Espande/comprime sezione metadati | OK | Funziona |
| 40 | **Bottone "+ Aggiungi" (Timeline)** | Apre dialog nuova interazione | OK | Funziona |
| 41 | **Select tipo interazione** | Sceglie tipo nel dialog | OK | 5 tipi disponibili |
| 42 | **Input titolo** | Titolo interazione | OK | Required per salvare |
| 43 | **Textarea descrizione** | Descrizione opzionale | OK | Funziona |
| 44 | **Select esito** | Esito opzionale | OK | 4 opzioni |
| 45 | **Bottone "Salva"** | Crea interazione nel DB | OK | Chiude dialog + toast + refetch |

---

### PROBLEMI CRITICI RILEVATI

**1. Deep Search -- completamente non funzionante (2 punti)**
- **GroupStrip Deep Search** (riga 72-75): mostra solo un toast placeholder `"Deep Search avviata su..."` ma non avvia nessun processo reale
- **Bulk Action Bar Deep Search** (riga 311): il bottone non ha nemmeno un `onClick` handler -- e inerte

**2. Campagna -- non funzionante (1 punto)**
- **Bulk Action Bar Campagna** (riga 319): nessun `onClick` handler -- bottone decorativo

**3. Console error: ref su componenti funzione**
- `ContactDetailPanel` usa `Dialog` senza wrapping corretto, genera warning `Function components cannot be given refs`
- `ContactCard` usa `Badge` che genera lo stesso warning

**4. Alias nel GroupStrip -- nessun feedback di loading**
- `handleGroupAlias` ha `aliasLoading` nello stato del parent ma il `GroupStrip` non riceve questa prop -- il bottone "Alias" resta cliccabile durante il processing

**5. Dati del DetailPanel non si aggiornano**
- Quando si genera un alias, `justGenerated` impedisce di rigenerare, ma il `contact` prop NON viene ri-fetchato automaticamente. Il dettaglio continua a mostrare i vecchi dati finche non si clicca su un altro contatto e si torna

**6. Filtro Search non filtra i gruppi**
- Il campo ricerca aggiorna `filters.search` ma la query `useContactGroupCounts` non utilizza questo parametro -- la ricerca non produce alcun effetto visibile

---

### PIANO DI FIX

#### 1. Implementare Deep Search per contatti
Collegare il bottone Deep Search (sia nel GroupStrip che nella Bulk Action Bar) all'edge function `deep-search-contact` esistente, con:
- Loading spinner nel bottone durante l'esecuzione
- Toast con risultato al completamento
- Refetch dei dati del contatto

#### 2. Implementare "Aggiungi a Campagna"
Collegare il bottone Campagna alla creazione di `campaign_jobs` (logica simile a "Job" ma con navigazione a `/campaigns`)

#### 3. Passare `aliasLoading` al GroupStrip
Aggiungere prop `isAliasLoading` al GroupStrip per disabilitare il bottone e mostrare spinner

#### 4. Aggiornare il contact nel DetailPanel dopo alias
Dopo `handleGenerateAlias`, ri-fetchare il contatto specifico dal DB e aggiornare il prop tramite callback `onSelect`

#### 5. Rendere la Search funzionale
Passare `filters.search` alla query `useContactsByGroup` e filtrare server-side, oppure filtrare client-side i risultati gia caricati

#### 6. Fix ref warnings
Wrappare `Badge` e `Dialog` con `React.forwardRef` dove necessario

### File da modificare:
1. `src/components/contacts/ContactListPanel.tsx` -- Deep Search handler, Campagna handler, aliasLoading prop, search filtering
2. `src/components/contacts/GroupStrip.tsx` -- prop isAliasLoading, disabilita bottone
3. `src/components/contacts/ContactDetailPanel.tsx` -- refetch contact dopo alias
4. `src/components/contacts/ContactCard.tsx` -- fix ref warning su Badge
5. `src/pages/Contacts.tsx` -- callback per aggiornare selectedContact dopo modifiche

