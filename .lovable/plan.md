# Piano Fase 4 + 5 — Responsive sweep & QA finale UI/UX

Le fasi 1-3 sono già state applicate (token semantici, PageShell, 3 pagine pilota). Restano da chiudere:
- **Fase 4**: passaggio responsive su tutte le pagine già migrate + bonifica colori hard-coded.
- **Fase 5**: QA finale temi/accessibilità.

Vincolo invariato: nessuna modifica a logica, query, hook, DAL, edge functions, routing, RLS, auth, comportamento filtri/realtime.

---

## Stato attuale (mappa rapida)

- 78 pagine in `src/v2/ui/pages/`
- 3 già su PageShell: Diagnostics, Telemetry, Notifications
- 28 file con colori Tailwind hard-coded (`text-green-500`, `bg-blue-100`, ecc.) — vanno migrati a token semantici (`text-success`, `bg-info/15`, `bg-muted/40`)
- Sidebar/drawer globali: `LayoutSidebarNav`, `ContextFiltersRail`, `FiltersDrawer`, `MissionDrawer` — già conformi al pattern overlay (mem `drawer-overlay-pattern`), da verificare solo a 360-414px

---

## Fase 4 — Responsive + bonifica colori

### 4.1 Bonifica colori hard-coded (28 file)
Sostituzione mappata 1:1, nessuna modifica strutturale:

| Hard-coded | Token semantico |
|---|---|
| `text-green-*`, `bg-green-*` | `text-success`, `bg-success/15`, `border-success/30` |
| `text-red-*`, `bg-red-*` | `text-destructive`, `bg-destructive/15` |
| `text-yellow-*`, `text-amber-*`, `bg-yellow-*` | `text-warning`, `bg-warning/15` |
| `text-blue-*`, `bg-blue-*` | `text-info`, `bg-info/15` |
| `bg-gray-*`, `bg-slate-*` | `bg-muted`, `bg-muted/40`, `border-border` |
| `text-gray-*`, `text-slate-*` | `text-muted-foreground`, `text-foreground` |

File coinvolti (raggruppati per area, in ordine di priorità):

**Operativo (alta visibilità)**
- `agenda/DepartmentKanbanView.tsx`
- `funnemail-inbox/MailReader.tsx`
- `email-forge/SherlockCanvas.tsx`, `components/DeepSearchHeader.tsx`, `DeepSearchContent.tsx`, `DeepSearchPageList.tsx`
- `cestinone/Toolbar.tsx`, `meta.ts`

**AI / Lab**
- `AILabPage.tsx`, `AgentCapabilitiesPage.tsx`
- `prompt-lab/HarmonizeReviewPanel.tsx`, `GlobalImproverDialog.tsx`, `SignalsBanner.tsx`, `SuggestionsReviewPage.tsx`, `RunHistoryPanel.tsx`, `PromptCopilotPanel.tsx`, `SplitBlockEditor.tsx`
- `prompt-lab/tabs/PromptTestsTab.tsx`, `JournalistsTab.tsx`, `SimulatorTab.tsx`
- `prompt-lab/atlas/ArchitectReviewPanel.tsx`

**Admin / Network**
- `KnowledgeBasePage.tsx`, `StaffPage.tsx`, `RADashboardPage.tsx`, `RAScrapingEnginePage.tsx`, `AcquisizionePartnerPage.tsx`, `CalendarPage.tsx`, `GuidaPage.tsx`
- `finder-api/FinderApiCatalogTab.tsx`, `FinderApiSchemaMapPage.tsx`
- `telemetry/SharedUI.tsx`

### 4.2 Responsive sweep — controlli mobile-first
Per ogni pagina migrata + per le 28 sopra, verifica veloce a 3 viewport (375 / 768 / 1280):

- **Container**: usare `PageShell` (`max-w-7xl`, `px-4 sm:px-6 lg:px-8`); rimuovere `w-[NNNpx]` fisse sostituendole con `w-full max-w-*`.
- **Header pagina**: titolo + descrizione + actions in `flex-col sm:flex-row` (già nel PageShell).
- **Toolbar/tab**: `flex-nowrap overflow-x-auto sm:flex-wrap` (già nel PageShell); badge tab non devono andare a capo singolo carattere.
- **Tabelle**: wrap in `<div class="overflow-x-auto rounded-md border">`; mai forzare colonne fisse <120px.
- **Form**: griglia `grid grid-cols-1 sm:grid-cols-2 gap-4`; input/select altezza `h-10`; label `text-sm`.
- **Sidebar/drawer**: a <768 sempre overlay (Sheet) con backdrop, mai flex item che spinge il contenuto. ContextFiltersRail già conforme.
- **Card grid**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` con `gap-4`.
- **Bottoni**: nelle azioni di header su mobile `w-full sm:w-auto`.

### 4.3 Pagine grandi da migrare a PageShell (lista chiusa)
Una alla volta, in ordine di rischio crescente (lasciate per ultime quelle con realtime/drawer custom):

1. KpiPage, AnalyticsPage, AdminUsersPage, DocsPage, GuidaPage (sicure)
2. SettingsPage, ObservabilityPage, StaffPage, KnowledgeBasePage (medie)
3. DashboardPage, CockpitPage, AgendaPage (delicate — ha grouping)
4. CRMPage, ContactsPage, OutreachPage (drawer/filtri pesanti)
5. EmailComposerPage, FunnemailInboxPage, EmailIntelligencePage (realtime + claim)

Per ognuna: solo wrap in `<PageShell title=... description=... actions=... toolbar=...>`; il contenuto interno NON viene rifattorizzato.

---

## Fase 5 — QA finale UI/UX/temi/accessibilità

### 5.1 Checklist temi (per ogni pagina toccata)
- [ ] Light: testo primario `text-foreground`, secondario `text-muted-foreground`, contrasto AA ≥ 4.5:1
- [ ] Dark: nessun grigio sotto `text-muted-foreground`; card `bg-card` + `border-border`
- [ ] Nessun colore Tailwind hard-coded residuo (`rg "(text|bg)-(green|red|blue|yellow|amber|emerald|sky|violet|rose)-[0-9]" src/v2/ui/pages/`)
- [ ] Badge: solo varianti shadcn semantiche (`success|warning|info|gold|destructive|muted|default|secondary|outline`)

### 5.2 Checklist componenti UI
- **Form**: label `text-sm font-medium`, errore `text-destructive text-xs mt-1`, helper `text-muted-foreground text-xs`
- **Tabelle**: header `bg-muted/40 text-muted-foreground text-xs uppercase`, row hover `hover:bg-muted/30`, empty state coerente
- **Bottoni**: variants `default|outline|secondary|ghost|destructive|link` — niente `bg-blue-500` inline
- **Sidebar**:
  - Sinistra (LayoutSidebarNav): navigazione, sezione attiva evidenziata
  - Destra (ContextFiltersRail / FiltersDrawer): filtri contestuali pagina, mai duplicare azioni dell'header
  - Mobile: entrambe in Sheet/drawer con backdrop

### 5.3 Accessibilità
- Focus visibile su tutti gli elementi interattivi (`focus-visible:ring-2 focus-visible:ring-ring`)
- `aria-label` su bottoni icon-only
- Heading hierarchy: 1 `<h1>` per pagina (già nel PageShell), poi `<h2>` per Section
- Contrasto verificato sui badge con trasparenza (`bg-*-500/15 text-*-500` — il foreground deve restare leggibile in dark)

### 5.4 Smoke test responsive
3 viewport, 6 pagine campione: Dashboard, CRM, Outreach, EmailIntelligence, PromptLab, Settings.

---

## Rischi da evitare

- Toccare logica/hook/DAL → vietato
- Rimuovere classi che pilotano comportamenti (es. `data-state`, `aria-*`)
- Cambiare struttura DOM di componenti che hanno hook su selettori (drawer, sheet, command)
- Modificare colori tema (`index.css`) — i token sono già definiti, va solo applicato
- Toccare `LayoutHeader.tsx`, `LayoutSidebarNav.tsx` core senza necessità

---

## Output finale atteso

1. Lista file modificati per fase
2. Diff colori hard-coded → token (conteggio prima/dopo via `rg`)
3. Pagine migrate a PageShell (con check responsive 375/768/1280)
4. Eventuali residui non bonificabili senza toccare logica → segnalati per sprint futuro

Approva e dimmi da quale gruppo partire (suggerito: **4.1 bonifica colori operativi** — basso rischio, alto impatto visivo).

---

## Stato avanzamento (2026-05-06)

- Fase 4.1 colori: completata sui file ad alta visibilità (operativo, AI/Lab, admin, network, prompt-lab, finder-api). Restano 24 occorrenze in `cestinone/meta.ts`, `agenda/DepartmentKanbanView.tsx` e `prompt-lab/SplitBlockEditor.tsx` che sono color-coding intenzionali (canali WA/Email/LI/Voce, dipartimenti, semantica diff verde/ambra) — **non bonificare** senza ridisegnare la mappa colori canali.
- Fase 4.3 PageShell: AdminUsersPage, AnalyticsPage, KpiPage, DocsPage, GuidaPage già migrate. SettingsPage e ObservabilityPage restano in standby (header e tab custom, alto rischio).
