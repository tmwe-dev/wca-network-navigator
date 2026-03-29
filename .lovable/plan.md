

# Piano di Ristrutturazione: Network, CRM, Outreach

## Situazione attuale e problema

Il sistema esterno gestisce ora i download WCA. Ma la sezione **Network** mostra ancora tutta l'infrastruttura di download (DownloadProgressBar, WcaSessionIndicator, download hooks, CountryGrid con filtri download, etc.). La pagina **Operations.tsx** (382 righe) e' dominata da logica download ormai inutile. La pagina **PartnerHub.tsx** (616 righe) referenzia ancora `useDownloadJobs` e mostra download attivi per paese.

## Cosa resta, cosa va

### RESTA
- **CountryGrid** come selettore paesi (senza logica download)
- **PartnerListPanel** con filtri qualita' (no profilo, no email, no tel)
- **PartnerDetailCompact** e dettaglio partner
- **DeepSearchCanvas** e generate aliases
- **StatPill** con metriche qualita'
- **PartnerHub** come rubrica partner con filtri, ordinamento, azioni bulk
- **CRM** con Contatti, Import, Biglietti, RA link
- **Outreach** con Cockpit, Workspace, Campagne, Attivita'

### VA RIMOSSO / SEMPLIFICATO
- Tutti i riferimenti download da **Operations.tsx**: `useWcaAppDownload`, `DownloadProgressBar`, `WcaSessionIndicator`, `handleStartDownload`, `handleResumeDownload`, badge "Download" attivo
- Riferimenti download da **PartnerHub.tsx**: `useDownloadJobs`, `activeDownloadForCountry`
- Il tab "Download WCA" da **Network.tsx** — Network diventa direttamente la rubrica partner con la griglia paesi integrata (unifica Operations + PartnerHub in un'unica vista pulita)

## Nuova struttura

### Network (singola vista, no tab)
La pagina Network diventa una vista unica che combina il meglio di Operations e PartnerHub:

```text
Network
├── Top bar: titolo + stat pills qualita' + AI assistant + tema
├── Col 1: CountryGrid (selettore paesi, senza download)
├── Col 2: PartnerListPanel (lista partner con filtri qualita')
├── Col 3: PartnerDetailCompact (dettaglio, deep search, social)
```

Essenzialmente Operations.tsx ripulito dai download. Niente piu' tab, niente piu' PartnerHub separato.

### CRM (invariato)
```text
CRM
├── Contatti (vista unificata multi-origine)
├── Import
├── Biglietti
└── Report Aziende (redirect /ra)
```

### Outreach (invariato)
```text
Outreach
├── Cockpit (lavoro 1-a-1)
├── Workspace (bulk email)
├── Campagne (monitoraggio)
└── Attivita' (task tracking)
```

## Modifiche tecniche

### 1. Ripulire `src/pages/Operations.tsx`
- Rimuovere: `useWcaAppDownload`, `DownloadProgressBar`, `WcaSessionIndicator`, `handleStartDownload`, `handleResumeDownload`, `suspended`, badge download, invalidation su `wcaDl.progress.phase`
- Mantenere: CountryGrid, PartnerListPanel, PartnerDetailCompact, DeepSearchCanvas, StatPills, AI assistant, tema dark/light, generate aliases

### 2. Semplificare `src/pages/Network.tsx`
- Rimuovere i 2 tab (Download WCA / Rubrica Partner)
- Caricare direttamente Operations (ripulito) come unica vista
- Eliminare il lazy loading di PartnerHub da qui

### 3. Ripulire `src/pages/PartnerHub.tsx`
- Rimuovere `useDownloadJobs` e `activeDownloadForCountry`
- Il componente rimane disponibile ma non piu' referenziato da Network

### 4. Rimuovere `onStartDownload` da `PartnerListPanel`
- `src/components/operations/PartnerListPanel.tsx`: togliere prop `onStartDownload` e i bottoni download dal toolbar

### 5. Pulizia componenti download non piu' usati
- I file in `src/components/download/` che sono solo download (ActiveJobBar, ActiveJobCard, DownloadProgressBar, JobMonitor, JobQueue, JobDataViewer, JobTerminalViewer, DownloadTerminal, SpeedGauge, LiveProfileCards, DownloadAgendaView, DownloadExperienceDialog, ResyncConfigure, WcaBrowser) possono essere marcati come deprecati o rimossi — ma non bloccano il piano
- `WcaSessionIndicator` va rimosso dalla top bar di Operations

### 6. Pulizia hooks download
- `useWcaAppDownload`, `useDownloadEngine`, `useDownloadJobs`, `useDirectoryDownload` non vengono piu' usati da Network/Operations — possono restare nel codebase per ora senza impatto

### 7. Sidebar
- Rinominare il link "Network" per chiarezza (resta `/network`)
- Nessun altro cambio alla sidebar

## Risultato

L'utente apre **Network** e vede subito la griglia paesi a sinistra, seleziona un paese, vede i partner con le metriche di qualita', clicca un partner e vede il dettaglio. Nessun riferimento a download. Azione principale: consultare, filtrare, deep search, generare alias, assegnare attivita'.

## File modificati
1. `src/pages/Network.tsx` — semplifica a vista diretta
2. `src/pages/Operations.tsx` — rimuovi tutta la logica download
3. `src/pages/PartnerHub.tsx` — rimuovi riferimenti download
4. `src/components/operations/PartnerListPanel.tsx` — rimuovi prop download

