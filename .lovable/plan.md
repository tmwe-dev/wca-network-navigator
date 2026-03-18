

## Aggiungere Workspace nell'Header

### Modifica

Aggiungere un bottone **Workspace** nella barra superiore (`AppLayout.tsx`), accanto ai bottoni Email e Agenda già presenti.

- Icona: `Layers` (o `LayoutDashboard`) per distinguerlo da Email (`Send`) e Agenda (`Calendar`)
- Click → `navigate("/workspace")`
- Stesso stile dei bottoni Email e Agenda esistenti
- Tooltip "Workspace"

### File da modificare
- `src/components/layout/AppLayout.tsx` — aggiungere un terzo bottone nell'header

