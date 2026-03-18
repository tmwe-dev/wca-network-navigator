

## Riorganizzazione Sidebar

### Modifiche

1. **Rimuovere "Prospects"** dalla sidebar (la pagina resta nel router ma non è accessibile dal menu)

2. **Riorganizzare i gruppi** in modo logico separando origini dati da maschere operative:

```text
── Panoramica ──────────────
   Super Home          /
   Global              /global

── Origini Dati ────────────
   Acquisition         /operations
   Rubrica Partner     /partner-hub
   Contatti            /contacts
   Import              /import

── Operativo ───────────────
   Cockpit             /cockpit
   Campaigns           /campaigns
   Email               /email-composer
   Operations          /hub
   Agenda              /reminders

── Sistema ─────────────────
   Impostazioni        /settings
   Diagnostica         /diagnostics
   Guida               /guida
```

### File da modificare
- `src/components/layout/AppSidebar.tsx` — solo l'array `navSections` (righe 14-44)

