

# Piano: Rimuovere Pulsante "Sincronizza Tutto" dalla Barra Header

## Analisi

Il pulsante `RefreshCw` (icona rotazione) nella `ConnectionStatusBar` fa due cose:
1. Lancia `sync-wca-trigger` — sincronizzazione WCA che è già gestita separatamente nella sezione dedicata (FiltersDrawer, CountryGrid, MissionDrawer)
2. Chiama `callCheckInbox` — scaricamento email che ha il suo flusso dedicato nella sezione Outreach/Email

È ridondante e confonde l'utente. La sincronizzazione WCA si fa dalla sua sezione, le email hanno il loro sistema. Il pulsante va rimosso.

## Intervento

**File: `src/components/layout/ConnectionStatusBar.tsx`**

- Rimuovere lo stato `syncing` e la funzione `handleSync`
- Rimuovere l'import di `RefreshCw`
- Rimuovere il blocco JSX del pulsante sync (righe ~195-210, il Tooltip con RefreshCw)
- Rimuovere l'import di `callCheckInbox`
- Nessun altro file da toccare: `useWcaSync`, `FiltersDrawer`, `CountryGrid` e `MissionDrawer` continueranno a funzionare indipendentemente con i loro trigger dedicati

