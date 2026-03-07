

## Diagnosi dei problemi nel Workspace

### Problemi identificati

**1. Disallineamento filtri ContactListPanel ↔ Workspace**
Il `ContactListPanel` filtra internamente la lista con i chip (es. "Con email"), ma `onSelectAll` nel parent `Workspace.tsx` (riga 94) seleziona TUTTI gli `emailActivities`, ignorando i filtri attivi nel pannello. Risultato: il checkbox "seleziona tutti" non si allinea mai con la lista filtrata.

**2. `onSelectAll` non conosce la lista filtrata**
Quando l'utente clicca il checkbox in alto dopo aver filtrato "Con email 15", il Workspace seleziona tutti (es. 30 attività), non solo i 15 filtrati. Il check `allSelected` nel ContactListPanel confronta `filtered` vs `selectedIds`, ma il set non corrisponde mai esattamente → il checkbox non risulta mai "checked".

**3. Stato `cancelled` non escluso nel ContactListPanel**
`Workspace.tsx` riga 59 esclude `cancelled`, ma `ContactListPanel` riga 101 filtra solo `completed`. Le attività cancellate appaiono nella lista del pannello ma vengono ignorate dalla generazione email.

**4. Genera email non funziona con filtri**
`handleGenerateAll` usa `emailActivities.filter(a => selectedIds.has(a.id))`. Se nessun ID è selezionato (perché il selectAll non funziona), genera su tutti — ma molti senza email vengono esclusi silenziosamente.

---

### Piano di fix

**A. ContactListPanel — esporre la lista filtrata al parent**
- Aggiungere una callback `onFilteredIdsChange?: (ids: string[]) => void` alle props
- Chiamarla con un `useEffect` ogni volta che `filtered` cambia
- In `Workspace.tsx`, mantenere uno stato `filteredIds` aggiornato dal pannello

**B. Workspace — `onSelectAll` deve selezionare solo gli ID filtrati**
- Cambiare `handleSelectAll` (riga 94) per usare `filteredIds` invece di `emailActivities`
- Cambiare `handleDeselectAll` per deselezionare solo gli ID filtrati (o tutti)

**C. ContactListPanel — escludere `cancelled`**
- Riga 101: aggiungere `&& a.status !== "cancelled"` al filtro

**D. Genera email — usare gli ID filtrati come fallback**
- In `handleGenerateAll` (riga 123), quando `selectedIds.size === 0`, usare `filteredIds` (non tutti gli emailActivities)

### File modificati
- `src/components/workspace/ContactListPanel.tsx` — aggiungere prop callback, fix filtro cancelled
- `src/pages/Workspace.tsx` — gestire filteredIds, fix selectAll/generateAll

