

# Piano: Tasto Elimina Jobs + Selezione Multi-Record

## Stato attuale

- **Sorting** (`Sorting.tsx`): Ha già selezione multipla con checkbox e "Scarta selezionati" (usa `useCancelJobs` che imposta status=cancelled, non elimina davvero)
- **ActivitiesTab** (`ActivitiesTab.tsx`): Ha già `useSelection`, `useDeleteActivities`, e bulk delete funzionante
- **Cockpit** (`ContactStream.tsx`): Ha selezione multipla ma **nessun tasto elimina** — solo Deep Search e Alias
- **CampaignJobs** (`CampaignJobs.tsx`): Ha selezione contatti ma **nessun tasto elimina jobs**
- **HubOperativo**: Importa `useDeleteActivities` ma va verificato se espone il bottone

## Interventi

### 1. Cockpit — Aggiungere "Elimina selezionati"
**File**: `src/components/cockpit/ContactStream.tsx`
- Aggiungere bottone `Trash2` nella barra bulk actions (accanto a Deep Search e Alias)
- Il bottone chiama una callback `onBulkDelete` passata come prop

**File**: `src/pages/Cockpit.tsx`
- Aggiungere handler `onBulkDelete` che elimina le attività/draft associati ai contatti selezionati via `useDeleteActivities`

### 2. Sorting — Cambiare "Scarta" in "Elimina" (DELETE reale)
**File**: `src/pages/Sorting.tsx`
- Il bottone "Scarta selezionati" attualmente usa `useCancelJobs` (imposta status=cancelled). Aggiungere un secondo bottone "Elimina" che usa `useDeleteActivities` per rimuovere davvero i record dal database

### 3. CampaignJobs — Aggiungere elimina bulk
**File**: `src/pages/CampaignJobs.tsx`
- Aggiungere bottone "Elimina selezionati" nella barra header quando ci sono contatti selezionati
- Creare un hook o riusare `useDeleteActivities` per eliminare i campaign_jobs selezionati

**File**: `src/hooks/useCampaignJobs.ts`
- Aggiungere `useDeleteCampaignJobs` mutation che fa DELETE reale sulla tabella `campaign_jobs`

### 4. Selezione colonna intera + multi-record ovunque
Tutte le sezioni che mostrano liste di jobs/attività devono avere:
- **Checkbox "seleziona tutti"** nell'header della lista/colonna
- **Checkbox per riga** su ogni record
- **Contatore selezione** visibile
- Riusare `useSelection` hook dove non è già usato

**File coinvolti per uniformare**:
- `src/components/sorting/SortingList.tsx` — già ha checkbox, verificare select-all nell'header
- `src/components/campaigns/JobList.tsx` — aggiungere checkbox select-all header
- `src/components/cockpit/ContactStream.tsx` — già ha select-all, aggiungere delete

### 5. Conferma eliminazione
Aggiungere un `AlertDialog` di conferma prima di ogni eliminazione bulk per evitare cancellazioni accidentali. Messaggio: "Eliminare X record? Questa azione è irreversibile."

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/cockpit/ContactStream.tsx` | Aggiungere bottone Elimina nella bulk bar |
| `src/pages/Cockpit.tsx` | Aggiungere handler delete + prop |
| `src/pages/Sorting.tsx` | Aggiungere bottone Elimina reale accanto a Scarta |
| `src/pages/CampaignJobs.tsx` | Aggiungere bulk delete con conferma |
| `src/hooks/useCampaignJobs.ts` | Aggiungere `useDeleteCampaignJobs` mutation |
| `src/components/campaigns/JobList.tsx` | Checkbox select-all nell'header |

