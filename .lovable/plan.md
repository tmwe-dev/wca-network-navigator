

# Flusso Completo: Network → Cockpit/Workspace → Attività → Sorting

## Stato attuale

- **Network (Operations.tsx)**: Mostra partner per paese con `PartnerListPanel`. Ha selezione singola (click su partner), ma **nessuna selezione multipla** e nessun bottone "Invia a Cockpit/Workspace".
- **PartnerHub**: Ha `UnifiedActionBar` con "Workspace" button che crea attività `send_email` — ma PartnerHub non è usato da Network.
- **Cockpit**: Carica automaticamente tutti i contatti da 3 sorgenti (WCA, Import, Prospect) tramite `useCockpitContacts`. Non ha concetto di "selezione inviata da Network".
- **Workspace**: Mostra attività esistenti di tipo `send_email` dalla tabella `activities`. Genera email e le manda al Sorting.
- **Sorting**: Mostra attività `pending` con `email_body` non null. Permette revisione e invio.

## Gap da colmare

1. **Network non ha selezione multipla** — serve checkbox sui partner + action bar
2. **Nessun meccanismo "Invia a Cockpit/Workspace"** — serve creare attività dalla selezione Network
3. **Nessun flag "lavorato oggi"** — serve nascondere partner già processati nella sessione
4. **Cockpit non filtra per "batch inviato"** — mostra tutto, non solo la selezione corrente
5. **Le azioni nel Cockpit/Workspace non creano automaticamente attività** — il flusso verso Sorting è parziale

## Piano di implementazione

### Fase 1: Selezione multipla in Network + Action Bar

**File: `src/components/operations/PartnerListPanel.tsx`**
- Aggiungere stato `selectedIds: Set<string>` con checkbox su ogni riga della `PartnerVirtualList`
- Aggiungere una barra azioni in alto quando `selectedIds.size > 0`: "Invia a Cockpit", "Invia a Workspace", "Deep Search", "Clear"
- Il bottone "Invia a Cockpit" crea attività in `activities` con `activity_type: 'send_email'`, `status: 'pending'`, `source_type: 'partner'` per ogni partner selezionato, poi naviga a `/outreach` tab cockpit
- Il bottone "Invia a Workspace" fa lo stesso ma naviga a `/outreach` tab workspace

**File: `src/components/operations/PartnerVirtualList.tsx`**
- Aggiungere prop `selectedIds`, `onToggleSelect` per rendere ogni riga selezionabile con checkbox

### Fase 2: Flag "lavorato oggi" in Network

**File: `src/components/operations/PartnerListPanel.tsx`**
- Aggiungere toggle "Nascondi lavorati" che filtra i partner che hanno già un'attività creata oggi (query dalla tabella `activities` dove `created_at >= oggi` e `source_id = partner.id`)
- Hook `useWorkedToday(countryCodes)` che fa una query leggera: `select distinct source_id from activities where source_type='partner' and created_at >= today`

### Fase 3: Cockpit — filtro per batch corrente

**File: `src/hooks/useCockpitContacts.ts`**
- Aggiungere filtro opzionale `batchOnly`: se attivo, mostra solo i contatti che hanno un'attività `pending` recente (creata nella sessione corrente)
- Il Cockpit mantiene la sua aggregazione automatica ma con possibilità di filtrare "Solo selezione corrente"

**File: `src/pages/Cockpit.tsx`**
- Aggiungere toggle "Solo batch" nella TopCommandBar per alternare tra vista completa e vista filtrata

### Fase 4: Azioni Cockpit/Workspace → Attività → Sorting

**File: `src/pages/Cockpit.tsx`**
- Quando l'utente genera un draft email (drag su canale email) e conferma, creare/aggiornare l'attività con `email_subject`, `email_body`, `status: 'pending'` — questo la rende visibile nel Sorting
- Dopo creazione attività, il contatto viene marcato come "lavorato" e sparisce dalla lista se il toggle è attivo

**File: `src/pages/Workspace.tsx`**
- Stessa logica: generazione email batch → attività con email_body → Sorting
- Dopo generazione, l'attività passa a Sorting automaticamente

### Fase 5: Sorting come coda di esecuzione unificata

**Già funzionante**: il Sorting (`useSortingJobs`) carica attività `pending` con `email_body` non null. Le azioni da Cockpit e Workspace che popolano `email_body` appariranno automaticamente nel Sorting.

Aggiunta: distinguere visivamente nel Sorting tra:
- **Immediati**: attività senza `scheduled_at` → eseguibili subito
- **Programmati**: attività con `scheduled_at` → mostrati con countdown

### Fase 6: Aggiornamento lead_status dopo esecuzione

**File: `src/hooks/useSortingJobs.ts` (useSendJob)**
- Dopo invio email riuscito, aggiornare `partners.lead_status` da `'new'` a `'contacted'` e impostare `last_interaction_at`
- Creare record in `interactions` per tracciare la history

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/operations/PartnerListPanel.tsx` | Selezione multipla + action bar + filtro "lavorati" |
| `src/components/operations/PartnerVirtualList.tsx` | Checkbox per selezione |
| `src/hooks/useWorkedToday.ts` | **Nuovo** — query partner lavorati oggi |
| `src/hooks/useCockpitContacts.ts` | Filtro batch opzionale |
| `src/pages/Cockpit.tsx` | Toggle "Solo batch" + creazione attività su draft |
| `src/pages/Workspace.tsx` | Routing attività verso Sorting |
| `src/hooks/useSortingJobs.ts` | Aggiornamento lead_status post-invio |
| `src/pages/Sorting.tsx` | Distinzione immediati vs programmati |

Nessuna modifica al database — la tabella `activities` ha già tutti i campi necessari (`source_type`, `source_id`, `email_subject`, `email_body`, `scheduled_at`, `status`).

