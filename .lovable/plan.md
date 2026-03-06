

## Piano: Collegare l'Assistente AI alla maschera Contatti

### Stato attuale
L'edge function `contacts-assistant` e il componente `ContactAIBar` esistono già e sono funzionanti. Il `ContactFiltersBar` li supporta tramite props. **Il problema**: `ContactListPanel` non passa `onAICommand`, `totalContacts`, `selectedCount` e `importGroups` al `ContactFiltersBar`, quindi l'AI bar non viene renderizzata.

### Modifiche necessarie

**`src/components/contacts/ContactListPanel.tsx`** — Collegare l'AI e le import groups

1. Importare `useImportGroups` e `useQueryClient`
2. Aggiungere `useUpdateLeadStatus()` e `useImportGroups()` nel componente
3. Creare il callback `handleAICommand` che gestisce i comandi strutturati:
   - `apply_filters` → `setFilters()` con i filtri ricevuti
   - `set_sort` → `setSortKey()`
   - `select_contacts` → `selection.addBatch(ids)`
   - `update_status` → `updateLeadStatus.mutate()` + invalidate query
   - `multi` → esegue tutti i sotto-comandi in sequenza
4. Passare al `ContactFiltersBar` le props mancanti:
   - `onAICommand={handleAICommand}`
   - `totalContacts={totalContacts}`
   - `selectedCount={selection.count}`
   - `importGroups={importGroups}`

### File da modificare

| File | Azione |
|------|--------|
| `src/components/contacts/ContactListPanel.tsx` | Aggiungere handler AI, import groups, passare props |

Nessun nuovo file da creare — tutto il codice backend e frontend esiste già.

