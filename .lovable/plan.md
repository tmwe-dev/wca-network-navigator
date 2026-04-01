

# Ripristinare SuperHome3D come Dashboard Principale

## Situazione

- `SuperHome3D.tsx` esiste, è completo e funzionante, ma **nessuna route lo carica più**
- La route `/` in `App.tsx` punta a `Dashboard.tsx` (versione ridotta: 2 card + OperationsCenter)
- `SuperHome3D` contiene: AI Prompt, Briefing Operativo, Agent Status, Active Jobs, 4 card navigazione con stats live, stato sistema

## Piano

### Rimettere SuperHome3D come pagina iniziale

1. **`src/App.tsx`**: cambiare l'import della route `/` da `Dashboard` a `SuperHome3D`
2. Mantenere `Dashboard.tsx` disponibile su una route secondaria (es. `/dashboard-legacy`) nel caso servisse

### Risultato

Torni ad aprire l'app e vedi subito: saluto, prompt AI, briefing operativo, stato agenti, job attivi, 4 card di navigazione con dati live.

## File modificati

| File | Modifica |
|------|----------|
| `src/App.tsx` | Route `/` → `SuperHome3D`, aggiungere route `/dashboard-legacy` per `Dashboard` |

