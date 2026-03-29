

# Riattivare la maschera Sorting in Outreach

Il componente `Sorting.tsx` esiste già nel codebase ed è funzionante. Va semplicemente aggiunto come tab "In Uscita" nel modulo Outreach, tra Cockpit e Workspace.

## Modifica

**`src/pages/Outreach.tsx`**:
- Aggiungere lazy import di `Sorting`
- Aggiungere tab "In Uscita" (icona `ArrowUpFromLine`) dopo "Cockpit"
- Renderizzare il componente Sorting quando il tab è attivo

Risultato: Cockpit → **In Uscita** → Workspace → Campagne → Attività

