

# Piano Corretto — v2 Completa, Tutte le 37 Pagine

## Principio

La v2 ricostruisce **tutto** il software, non una versione ridotta. Ogni pagina v1 viene portata nella v2 con architettura pulita (Result, Bridge, Hook, componenti < 300 LOC). Nessuna esclusione.

## Blocchi di esecuzione rivisti

### Blocco A — Dashboard + Network
- **DashboardPage**: metriche live dal DB, card cliccabili
- **NetworkPage**: filtri avanzati, paginazione server-side, PartnerDetailDrawer, export

### Blocco B — CRM + Contatti
- **CRMPage**: filtri, ContactDetailDrawer, ContactForm CRUD
- **ContactsPage** (rubrica): vista contatti separata da CRM
- **ProspectCenter**: pipeline acquisizione, prospecting funzionale

### Blocco C — Outreach + Inreach + Email
- **OutreachPage**: attività con filtri, ActivityDetailDrawer, azioni rapide
- **InreachPage**: email ricevute, task generati da email in entrata
- **EmailComposerPage**: editor email con AI assistant
- **Agenda**: attività e follow-up pianificati

### Blocco D — Agenti + Missioni + Campagne
- **AgentsPage**: card agenti, chat AI, task list
- **AgentChatHub**: chat completa con agenti AI
- **MissionBuilder**: creazione missioni per agenti
- **CockpitPage**: dashboard operativa agenti
- **CampaignsPage**: lista campagne, job queue, pause/resume, tracking

### Blocco E — Staff + AI + Knowledge
- **StaffDirezionale**: briefing AI, chat canvas con markdown/TTS/STT, file upload, ai_work_plans
- **AILab**: playground prompt e agenti
- **Knowledge Base**: gestione kb_entries, operative_prompts, ai_memory

### Blocco F — Research & Analysis
- **RADashboard**: dashboard RA
- **RAExplorer**: esplorazione dati
- **RAScrapingEngine**: motore scraping
- (4a pagina RA da verificare nel codice v1)

### Blocco G — Globe + Visualizzazione
- **SuperHome3D**: globo Three.js interattivo con dati live, metriche, punti partner su mappa
- **Deep Search**: ricerca avanzata cross-modulo

### Blocco H — Utilities + Settings + System
- **SettingsPage**: tutti i 14 sub-tab reali (Generale, AI, Connessioni, Voce, Import, Email, Report, Enrichment, Memoria, Abbonamento, Operatori, Utenti, Timing)
- **DiagnosticsPage**: check reali (DB, Auth, Edge, WCA, Bridge)
- **ImportPage**: wizard CSV completo
- **SortingPage**: regole ordinamento
- **TelemetryPage**: metriche, log strutturati, monitoring
- **OperationsPage**: operazioni batch

### Blocco I — Polish + Audit Finale
- Sidebar completa con tutte le voci e badge conteggi
- Mobile responsive
- Error boundaries
- Test coverage per ogni modulo nuovo
- Zero placeholder, zero "In costruzione"
- Build green, zero errori TS

## Regole invariate

- Componenti < 300 LOC, logica negli hook
- Ogni IO ritorna `Result<T>`, mai throw
- Zero `any`, naming di dominio
- Pattern Core/IO/Bridge rispettato ovunque
- Procedo blocco A → I senza interruzioni

## Stima

9 blocchi, esecuzione continua. Tutte le 37 pagine v1 ricostruite in v2.

