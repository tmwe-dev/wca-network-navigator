

## Analisi delle 5 maschere "orfane" (non in sidebar)

### 1. `/v2/globe` — **Globo 3D Network WCA**
- **Componente**: `GlobePage` → `CampaignGlobe` (React Three Fiber)
- **Cosa fa**: visualizzazione 3D interattiva del pianeta Terra con marker per i ~12.000 partner WCA. Click su un paese → zoom + lista partner della nazione, città evidenziate, connessioni di rotta animate, aeroplanini in volo, aurora boreale.
- **Stato**: **funzionante**, dati reali da `usePartnersForGlobe`. È una versione "scenografica" della mappa Network.
- **Sovrapposizione con menu**: parzialmente duplica `/v2/network` (che mostra la stessa info in griglia). Differenza: il Globo è visuale/wow, Network è operativo/lavorativo.

### 2. `/v2/sorting` — **Coda di smistamento email/job**
- **Componente**: `Sorting` (V1) — split list (40%) + canvas (60%)
- **Cosa fa**: gestione dei "sorting jobs" — code di proposte AI da approvare/scartare/inviare in batch (bulk review, bulk send con progress bar, eliminazione attività). Hook: `useSortingJobs`, `useBulkReview`, `useSendJob`.
- **Stato**: **funzionante**, è il pannello di **revisione massiva** delle azioni AI prima dell'invio reale.
- **Ruolo**: è di fatto la **bacheca di approvazione umana** del workflow Plan → Approve → Execute. Fondamentale per la governance, ma oggi nascosto.

### 3. `/v2/research` (in sidebar) → `/v2/ra-explorer` + `/v2/ra-scraping` + `/v2/ra-company/:id`
Sezione **Report Aziende** (RA = registro aziende italiano, no WCA).

- **`/v2/research` (RADashboard)**: KPI generali + lista job di scraping recenti + accessi rapidi alle altre due pagine. **È il dashboard, già esposto in sidebar** sotto "Research".
- **`/v2/ra-explorer`**: **navigatore ATECO** a 3 colonne. Sinistra = sezioni ATECO (A–U), centro = lista prospect filtrati per categoria/ricerca (`useRAProspects`), destra = contatti del prospect selezionato (`useRAProspectContacts`). Serve per **esplorare i dati già scrappati**.
- **`/v2/ra-scraping`**: **Motore di scraping** — Tabs (Ricerca / Job / Config). Configura ATECO + Regioni + slider, lancia job di scraping, monitora avanzamento, log. Serve per **acquisire nuovi prospect dal registro aziende**.
- **`/v2/ra-company/:id`**: dettaglio singola azienda + contatti.

**Stato**: **3 pagine funzionanti e collegate logicamente**, ma da `RADashboard` si può navigare verso le altre due (esiste già il bridge). Oggi l'utente non sa che esistono perché non sono in sidebar e il dashboard non le mostra come voci di menu prominenti.

### 4. `/v2/ai-arena` — **Sessione speed-outreach con LUCA**
- **Componente**: `AIArenaPage` → `ArenaPreSession` / `ArenaActiveSession` con hook `useArenaSession`
- **Cosa fa**: modalità "gioco" — l'AI propone un contatto alla volta da raggiungere (con email pre-generata), tu **Conferma / Salta / Modifica / Blacklist** in stile carte 3D (ContactCard3D), con timer, particelle e session summary alla fine. È documentato in memory `mem://agents/luca-persona-and-arena`.
- **Stato**: **funzionante**, è una delle feature distintive del prodotto. Inspiegabilmente non in sidebar V2 (in V1 era in "AI" group).

### 5. `/v2/design-system-preview` — **Showcase componenti tecnici**
- **Componente**: `DesignSystemPreviewPage` — pagina demo che mostra tutti i componenti del design system "IntelliFlow" (AiEntity, VoicePresence, ExecutionFlow, ApprovalPanel, CanvasShell, FloatingDock, ToolActivationBar) con dati mock.
- **Stato**: **strumento interno per sviluppatori / designer**, non per utenti finali. Va lasciata raggiungibile solo via deep-link.

---

## Sintesi e proposta di sistemazione

| Pagina | Cosa fa | Proposta |
|---|---|---|
| `/v2/globe` | Globo 3D partner | **Voce in "Panoramica" → "Globo Network"** (alternativa visuale a Network) |
| `/v2/sorting` | Approvazione massiva job AI | **Voce in "Comunicazione" → "Approvazioni"** (governance cruciale) |
| `/v2/ra-explorer` | Esplora prospect ATECO scrappati | Linkata da dentro `/v2/research` (già esiste). Eventualmente promuoverla come voce sotto "Intelligence → Report Aziende" |
| `/v2/ra-scraping` | Lancia job scraping registro aziende | Linkata da dentro `/v2/research` (già esiste). Eventualmente promuoverla |
| `/v2/ai-arena` | Speed-outreach gamificato con LUCA | **Voce in "Comunicazione" → "AI Arena"** (con badge ⚡ visibile) |
| `/v2/design-system-preview` | Showcase tecnico | **Lasciare orfana** — solo deep-link per sviluppo |

Domanda secca per procedere:
- vuoi che esponga in sidebar **Globo, Sorting (Approvazioni) e AI Arena** subito, e lasci RA Explorer / RA Scraping accessibili tramite il dashboard `/v2/research` (con magari un upgrade del dashboard che le metta in evidenza)?
- oppure preferisci esporre **anche le 2 pagine RA** come sotto-voci di "Research" in sidebar?

