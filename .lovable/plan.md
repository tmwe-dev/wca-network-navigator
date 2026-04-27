# UX Redesign — Navigazione 6 destinazioni + Golden Layout

Implementazione del brief "WCA Partner Connect — UX Redesign Brief v1.0". Il piano è splittato in **5 fasi consegnabili**, ognuna pubblicabile e testabile in isolamento. Ogni fase mantiene retrocompatibilità: le vecchie route NON vengono cancellate finché tutte le pagine non sono state migrate, ma vengono **redirezionate** alle nuove sezioni — stesso pattern già usato per il deprecation V1→V2.

Audit reale conferma stato attuale: **27 voci** in 7 gruppi, **8 pin** sul FloatingDock, **~62 pagine** in `src/v2/ui/pages/`, layout disomogenei. Il `ContactsPage` è già una reference quasi-conforme al Golden Layout.

---

## Fase 1 — Fondamenta (consegnabile da sola)

Obiettivo: nuovo menu a 6 voci, primitive `Golden*` pronte, breadcrumb automatico, FloatingDock rimosso. Tutte le vecchie pagine restano accessibili tramite le nuove sezioni o redirect.

### Componenti nuovi
- `src/v2/ui/templates/GoldenLayout.tsx` — wrapper `ResizablePanelGroup` (40/60), gestisce stato URL `?id=`, responsive (mobile = stack + overlay), animazione `transition-all duration-200`.
- `src/v2/ui/templates/GoldenListPanel.tsx` — search bar + filter pills + lista scrollabile + pagination, render-prop per gli item.
- `src/v2/ui/templates/GoldenDetailPanel.tsx` — entity header + tab-bar interna + content area + close button.
- `src/v2/ui/templates/GoldenHeaderBar.tsx` — breadcrumb derivato dalla route (`Sezione > Tab > Entità`) + slot per azioni contestuali (`+ Nuovo`, filtri).
- `src/v2/ui/atoms/StatusPill.tsx` — pill filtro con conteggio e colore status.
- `src/v2/ui/molecules/EntityListItem.tsx` — riga lista standard con avatar/nome/meta/score.
- `src/v2/ui/templates/SectionTabs.tsx` — wrapper tab orizzontali con lazy loading, usato da ogni "Section".

### Sidebar e Mobile nav
- Riscrivere `src/v2/ui/templates/navConfig.tsx` con **6 voci piatte** (no gruppi):
  - `Home` → `/v2`
  - `Esplora` → `/v2/explore`
  - `Pipeline` → `/v2/pipeline`
  - `Comunica` → `/v2/communicate`
  - `Intelligence` → `/v2/intelligence`
  - `Config` → `/v2/settings`
- Aggiornare `LayoutSidebarNav.tsx`: rimuovere logica `navGroupsDef` con titoli di gruppo, mostrare lista piatta di 6 icone+label, mantenere divider/footer (WCA status, theme, logout).
- **Eliminare** `FloatingDock` (sia `src/components/layout/FloatingDock.tsx` sia `src/design-system/FloatingDock.tsx`) e il relativo `<FloatingDock />` dal `AuthenticatedLayout`. Aggiornare `pinnedNavItems` (rimuovere o lasciare deprecato no-op).
- `MobileBottomNav`: aggiornare `mobileBottomNavPaths` a `["/v2", "/v2/pipeline", "/v2/communicate", "/v2/settings"]`.

### Routing
- Aggiungere in `src/v2/routes.tsx` 5 nuove route "Section":
  - `/v2/explore/*` → `ExploreSection`
  - `/v2/pipeline/*` → `PipelineSection`
  - `/v2/communicate/*` → `CommunicateSection`
  - `/v2/intelligence/*` → `IntelligenceSection`
  - `/v2/settings/*` (la rotta esiste già; espanderla a Section)
- In Fase 1 ogni `*Section.tsx` monta il **componente esistente** del primo tab + `SectionTabs` con link agli altri tab che puntano alle vecchie route. Nessuna pagina viene riscritta o cancellata in questa fase.
- Aggiungere **redirect-map** retrocompatibili (estendendo il pattern di `architecture/v1-deprecation-redirect`): es. `/v2/inreach` → `/v2/communicate/inbox`, `/v2/outreach` → `/v2/communicate/outreach`, ecc. Le vecchie route restano funzionanti via `<Navigate replace>`.

### Migrazione referenza
- `ContactsPage` viene wrappata in `GoldenLayout` (cambia poco: già usa `ResizablePanelGroup` con percentuali compatibili). Diventa la reference vivente per gli altri.

### Acceptance Fase 1
- Sidebar mostra esattamente 6 voci.
- FloatingDock non appare in nessuna pagina autenticata.
- Breadcrumb visibile su `ContactsPage` (es. `Pipeline > Contatti > [Nome]`).
- Tutti i link del menu vecchio continuano a funzionare via redirect (no 404).
- Mobile bottom nav mostra 4 voci nuove + FAB Mission.

---

## Fase 2 — Pipeline

`PipelineSection` con 4 tab: **Contatti / Kanban / Deals / Agenda**.

- `Contatti` = `ContactsPage` già migrata in Fase 1.
- `Kanban` = estrai il tab pipeline da `CRMPage` in un componente dedicato (board kanban — eccezione documentata al golden layout).
- `Deals` = wrappare `DealsPage` in `GoldenLayout` (lista deals left, dettaglio deal right).
- `Agenda` = wrappare `AgendaPage` in `GoldenLayout` (lista follow-up left, dettaglio right).
- Integrare `ProspectPage` e `AcquisizionePartnerPage` come **filtri/modi** del tab Contatti (non più pagine a sé).
- Redirect: `/v2/crm`, `/v2/agenda`, `/v2/deals`, `/v2/prospects`, `/v2/acquisizione-partner` → tab corrispondenti.

---

## Fase 3 — Comunica

`CommunicateSection` con 4 tab: **Inbox / Outreach / Componi / Approvazioni**.

- `Inbox` = `InreachPage` riscritta in `GoldenLayout` (lista email a sinistra, dettaglio email a destra). Eliminare layout custom.
- `Outreach` = `OutreachPage` migrata: **rimuovere `VerticalTabNav`** (deprecato), portare la coda a sinistra e il dettaglio job/dispatch a destra in `GoldenLayout`.
- `Componi` = merge `EmailComposerPage` + `EmailForgePage`: lista template a sinistra, editor a destra.
- `Approvazioni` = `SortingPage` in `GoldenLayout` (lista pending left, review right).
- Integrare `CockpitPage` come **modalità interna** del tab Outreach (era già embedded in Outreach).
- Redirect: `/v2/inreach`, `/v2/outreach`, `/v2/outreach/composer`, `/v2/sorting`, `/v2/cockpit`, `/v2/email-forge` → tab corrispondenti.

---

## Fase 4 — Intelligence

`IntelligenceSection` con 5 tab: **Analytics / Agenti / Prompt Lab / KB / Control**.

- `Analytics` = merge `AnalyticsPage` + `EmailIntelligencePage` (dashboard grid — eccezione).
- `Agenti` = merge `AgentsPage` + `StaffPage` + `AIArenaPage` in `GoldenLayout`: lista agenti a sinistra, configurazione/chat/persona/capabilities/tasks come **sotto-tab del detail panel** a destra.
- `Prompt Lab` = `PromptLabPage` (già conforme), solo spostata.
- `KB` = merge `KnowledgeBasePage` + `KBSupervisorPage` (KBSupervisor già conforme).
- `Control` = merge `AIControlCenterPage` + `TokenCockpitPage` + `ObservabilityPage` (dashboard grid — eccezione).
- Integrare `MissionBuilderPage` + `MissionsAutopilotPage` + `AILabPage` come sotto-tab di Agenti / Prompt Lab.
- Redirect: tutte le vecchie route AI ops → tab corrispondenti.

---

## Fase 5 — Esplora, Home, Cleanup

### Home (`/v2`)
- `DashboardPage` resta come contenuto (eccezione golden layout — è dashboard grid).
- `CommandPage` diventa **panel collassabile** embedded nella dashboard (non più pagina separata, ma `/v2/command` continua a funzionare via redirect alla home con drawer aperto).
- `NotificationsPage` diventa **dropdown nell'header** del `AuthenticatedLayout` (badge + popover).

### Esplora (`/v2/explore`) con 4 tab: **Mappa / Cerca / Deep Search / Campagne**
- `Mappa` = merge `GlobePage` + `NetworkPage` (full-screen map — eccezione).
- `Cerca` = `ContactsPage` in modalità search-only con preset filtri.
- `Deep Search` = merge `DeepSearchPage` + `RAExplorerPage` + `RADashboardPage` + `RAScrapingEnginePage` + `RACompanyDetailPage` in `GoldenLayout`.
- `Campagne` = `CampaignsPage` + `CampaignJobsPage` in `GoldenLayout`.

### Config (`/v2/settings`) con 5 tab: **Generali / Guida / Token / Calendario / Admin**
- Integrare `ImportPage`, `EmailDownloadPage`, `DPAPage`, `DiagnosticsPage`, `TelemetryPage` come sotto-sezioni di `Generali` o `Admin`.

### Cleanup finale
- Eliminare fisicamente le pagine deprecate: `PlaceholderPage`, `DesignSystemPreviewPage`, `LandingPage` (resta separata fuori dal CRM), `OnboardingPage`/`GuidedOnboardingPage` (flusso one-time, non in menu).
- Mantenere ma archiviare: `CockpitPage`, `EmailForgePage`, ecc. → restano nei file ma non sono più nel router (consultare `mem://project/development-status-governance` per la policy "non eliminare codice in sviluppo").
- Rimuovere i redirect-map una volta verificato che nessun link interno punta più alle vecchie route.

---

## Dettagli tecnici

- **URL state**: `useUrlState("id", "")` per la selezione entità in tutti i `GoldenLayout` (pattern già usato in `ContactsPage`).
- **Lazy loading**: ogni tab in `SectionTabs` usa `React.lazy` + `Suspense` con `PageSkeleton`, wrappato in `FeatureErrorBoundary` (riusare l'helper `guardedPage` esistente).
- **Breadcrumb**: derivato da una mappa `route → label` in `src/v2/ui/templates/breadcrumbConfig.ts`, parsato dal `useLocation().pathname`. Mai hardcodato nelle pagine.
- **Redirect map**: estendere il file esistente che gestisce `/v1/*` (cfr `mem://architecture/v1-deprecation-redirect`) con sezione "legacy v2 routes".
- **Materialized views**: dove disponibili (`v_pipeline_lead`, `v_inbox_unified`, `v_outreach_today`) usarle nei `GoldenListPanel` invece di query dirette — passa per il DAL (`src/data/`).
- **Nessuna modifica al backend** in nessuna fase. Solo UI/routing.
- **i18n**: aggiungere chiavi `nav.home`, `nav.explore`, `nav.pipeline`, `nav.communicate`, `nav.intelligence`, `nav.config` ai locali esistenti (it/en); rimuovere chiavi `nav.group_*` non più usate.
- **Test E2E**: aggiornare `e2e/smoke/08-v2-navigation.spec.ts` e `e2e/navigation.spec.ts` con i nuovi 6 path. Le vecchie spec continuano a passare grazie ai redirect.
- **Telemetria**: tracciare evento `nav_redesign_v2_tab_open` per misurare adozione e completare la metrica "click per raggiungere funzione".

---

## Cosa NON fa questo piano

- Non tocca AuthProvider, RLS, edge functions, KB, prompt assembler.
- Non modifica `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo `mem://constraints/email-download-integrity`).
- Non rimuove fisicamente codice "in sviluppo" senza tua autorizzazione esplicita (`mem://project/development-status-governance`).
- Non introduce nuovi pattern di layout — solo Golden Layout + 5 eccezioni documentate (Dashboard, Mappa, Kanban, Analytics, Calendar).

---

## Consegne per fase

| Fase | Output utente visibile |
|------|------------------------|
| 1 | Menu pulito a 6 voci, breadcrumb, niente FloatingDock, ContactsPage golden |
| 2 | Sezione Pipeline completa con 4 tab golden |
| 3 | Sezione Comunica completa, VerticalTabNav rimosso |
| 4 | Sezione Intelligence completa con sotto-tab agenti unificati |
| 5 | Home con Command embedded, Esplora, Config riorganizzato, cleanup |

Posso eseguire **solo la Fase 1** dopo l'approvazione (consigliato: consegna concreta in poche ore, zero regressioni grazie ai redirect) e attendere il tuo OK prima di partire con la Fase 2. In alternativa procedo end-to-end Fase 1→5 in sequenza.
