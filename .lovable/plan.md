

# Ripristinare la Dashboard Dinamica

## Situazione attuale

- `Dashboard.tsx` mostra solo 2 card statiche (Network, CRM) + 3 quick stats hardcoded a zero
- `OperationsCenter.tsx` esiste ma non è importato da nessuna parte — è codice orfano
- L'hook `useOperationsCenter` è funzionante e fornisce: download jobs, agent tasks, email queue, activities, stats real-time

## Piano

### Reintegrare OperationsCenter nella Dashboard

Modificare `src/pages/Dashboard.tsx`:

1. Mantenere le 2 card principali (Network, CRM) in alto come accesso rapido
2. Sostituire i 3 quick stats hardcoded con i dati reali da `useOperationsCenter`:
   - **Attività in sospeso** → `stats.pendingActivities`
   - **Email in coda** → `stats.pendingEmails`
   - **Task agenti attivi** → `stats.runningTasks`
3. Aggiungere sotto le card il componente `<OperationsCenter />` con le sue tab (overview, downloads, agent tasks, email queue, activities)
4. Rimuovere `overflow-hidden` dal container per permettere lo scroll quando il contenuto è più lungo dello schermo

### Risultato

La Dashboard torna ad essere un centro operativo vivo con dati real-time, mantenendo l'accesso rapido alle due aree principali in alto.

## File modificati

| File | Cosa |
|------|------|
| `src/pages/Dashboard.tsx` | Import OperationsCenter, stats reali, layout scrollabile |

