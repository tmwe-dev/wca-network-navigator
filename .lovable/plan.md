

# Sidebar Context-Aware: Nascondere CRM/Network in base alla sezione

## Cosa cambia

La sidebar diventa **dinamica**: quando sei in `/network` (o sotto-route network), la voce "CRM" sparisce. Quando sei in `/crm`, la voce "Network" sparisce. Dalla Dashboard (`/`) o da qualsiasi strumento condiviso, entrambe restano visibili.

## Logica

Basata su `location.pathname`:
- Se path inizia con `/network` → nascondi CRM
- Se path inizia con `/crm` → nascondi Network  
- Altrimenti → mostra tutto

## File da modificare

### `src/components/layout/AppSidebar.tsx`

Trasformare `navSections` da costante statica a funzione che riceve il pathname corrente e filtra le voci:

```typescript
function getNavSections(pathname: string) {
  const inNetwork = pathname.startsWith("/network");
  const inCRM = pathname.startsWith("/crm");
  
  return [
    {
      label: "Aree",
      items: [
        { title: "Dashboard", url: "/", icon: Home },
        !inCRM && { title: "Network", url: "/network", icon: Globe },
        !inNetwork && { title: "CRM", url: "/crm", icon: Users },
      ].filter(Boolean),
    },
    // Strumenti e Sistema invariati
  ];
}
```

Un solo file, ~10 righe di modifica.

