# Ristrutturazione UX: shell uniforme + bonifica maschere

## 1. Cosa ho trovato (audit)

### Shell attuale
- **Menu unico**: hamburger in alto-sx → `NavMenuPopover`. Sorgenti: `navItemsDef` (navConfig) + `SECONDARY_NAV` (registry) + `EXPANDABLE_MAIN_NAV` (tab Settings). Funziona ma mescola 16 voci pinned + 7 gruppi "Development" + 40 sotto-voci → l'utente non sa dove sta una pagina.
- **Sidebar SINISTRA = filtri** (`ContextFiltersRail`): si attiva SOLO per i path mappati in `getFilterContext`. La maggior parte delle pagine non ha filtri (rail = `null`).
- **Sidebar DESTRA = workflow** (`MissionDrawer`): contestuale solo per outreach/network/crm/settings/explore. Ovunque altrove mostra il generico "Mission Control" (goal/preset) **irrilevante** al contesto.
- **AI in-mask**: NON esiste un accesso AI uniforme in cima a ogni maschera. Ci sono solo overlay globali sparsi (FloatingCoPilot, Command palette ⌘K, StatusPill).

### Problemi concreti
1. **Filtri orfani**: 8 `*FiltersSection` esistono ma NON sono cablate in `getFilterContext` → codice morto: `Inbox`, `CodaAI`, `Circuit`, `Outgoing`, `Attivita`, `ABTest`, `Workspace`, (`Arena` cablata ma minima).
2. **Filtri stub** (≤24 righe, vuoti/placeholder): `Sorting`, `CodaAI`, `Circuit`, `Outgoing`, `Attivita`, `ABTest`, `Workspace`, `FunnemailInbox`.
3. **Workflow dx non contestuale** sulla maggior parte delle pagine (mostra Mission Control fuori luogo).
4. **Nessun contratto comune**: ogni pagina decide da sé header, tabs, filtri, azioni → incoerenza totale.
5. **Sovrabbondanza di maschere** con funzioni duplicate (email, prompt-lab, agenti, analytics, RA/acquisizione).

## 2. Architettura target (contratto unico per OGNI maschera)

Ogni pagina (incluse le speciali Command/Cockpit/Campagne, che mantengono il loro contenuto) viene avvolta da un guscio standard `StandardPageFrame` con 4 zone fisse:

```text
+------------------------------------------------------------------+
|  [☰ menu]  Breadcrumb / Titolo        [ ✦ AI ]  [azioni pagina]  |  <- header in-mask (AI sempre qui)
+----+--------------------------------------------------------+----+
| F  |                                                        | W  |
| I  |                  CONTENUTO MASCHERA                     | O  |
| L  |                                                        | R  |
| T  |                                                        | K  |
| R  |                                                        | F  |
| I  |  (tabs di sezione standard se presenti)                | L  |
+----+--------------------------------------------------------+----+
  ^sx = SOLO filtri                              dx = SOLO workflow^
```

- **SX (filtri)**: riusa `ContextFiltersRail`, ma il contenuto è risolto da un **registry unico** `pageContract` (1 riga per pagina) invece dell'`if/else` su pathname. Pagine senza filtri → linguetta nascosta (non rail vuota).
- **DX (workflow)**: nuovo `WorkflowRail` che sostituisce il routing per-pathname di `MissionDrawer`. Mostra, per pagina, i blocchi dichiarati nel contract: `azioni rapide`, `processi/missioni`, `suggerimenti AI`, `scorciatoie`. Default vuoto = linguetta nascosta (mai pannello generico fuori contesto).
- **AI in-mask**: pulsante `✦ AI` fisso nell'header della maschera, apre il CoPilot già filtrato sul contesto pagina. Uniforme ovunque.
- **Tabs**: tutte le sezioni con sotto-pagine usano `SectionTabs variant="pill"` (un solo stile). Le speciali tengono i loro tab ma con lo stesso componente/stile.

### Il "contract" (single source of truth)
`src/v2/navigation/pageContract.ts` — una mappa `path → { title, group, filters?, workflow?, ai?, tabs? }`. Da qui derivano: menu (gruppi), breadcrumb, filtri sx, workflow dx, AI. **Un solo posto da editare per pagina.**

## 3. Menu riorganizzato (gruppi intelligenti)

7 macro-aree (allineate alla memoria 7-Cassetto), ogni pagina assegnata a UNA sola:
1. **Comando** — Command, Dashboard/KPI
2. **Esplora** — Network, Mappa/Globe, Sherlock/DeepSearch, Acquisizione/RA/Prospects, Finder API
3. **Pipeline** — Contatti CRM, Biglietti, Agenda/Kanban, Campagne
4. **Comunica** — Comms (Inbox/Email/WA/LinkedIn/Funnemail), Cestinone (coda invii), Email Intelligence
5. **Cervello/Intelligence** — Agenti, Prompt Lab, KB, AI Control
6. **Config** — Settings (tabs), Admin, Routing
7. **Lab/Sistema** — solo dev/diagnostica (nascosto agli operatori)

## 4. Scaletta 100→0 — utilità delle maschere

**100–80 (core, tenere e potenziare)**: Command, Comms, Cockpit, Agenda/Pipeline, Network, Contatti CRM, Cestinone, Settings, Email Intelligence, KB, Agenti.

**79–55 (utili, consolidare)**: Campagne, DeepSearch/Sherlock, Acquisizione Partner, Prospects, Analytics/KPI, AI Control, Notifications, Guida.

**54–35 (overlap → unire in un hub)**:
- Email: `EmailForge`, `EmailLab`, `EmailStrategies`, `BrandVoice` → confluire in **un solo "Email Lab"** a tab.
- Prompt: `PromptLab`, `PromptCatalog`, `PromptTests`, `AgentAtlas`, `Suggestions`, `Proposals`, `PromptReader`, `Brain` → **un solo "Prompt Lab"** a tab (già esiste l'hub `/v2/lab`).
- Agenti: `AgentsPage`, `AgentChatHub`, `AgentCapabilities`, `AgentTasks`, `AgentRolesOverview`, `AgentPersonaEditor` → **un solo "Agenti"** a tab.
- Analytics: `Dashboard`, `KPI`, `Analytics`, `Telemetry`, `Observability`, `TokenCockpit`, `PipelineTraces`, `AiInteractionLog` → **un "Analytics" hub** a tab.
- RA: `RADashboard`, `RAExplorer`, `RAScraping`, `RACompanyDetail`, `AcquisizionePartner`, `FinderApi` → **un "Acquisizione" hub**.

**34–15 (bassa utilità, declassare a deep-link/tab)**: `CalendarPage` (dup Agenda), `CampaignJobs` (tab Campagne), `EmailIntelligenceOperations` (tab), `KBSupervisor` (tab KB), `AlertRouting` (tab AI Control), `StaffPage`, `TmweClients`, `Docs`, `DPA`.

**14–0 (deprecare/rimuovere)**:
- `PlaceholderPage` (placeholder), `SimpleHomePage` (home alternativa morta), `AIArenaPage` (demo 3D), `DesignSystemPreviewPage` (dev), `MissionBuilderPage` (dup Autopilot), `E2EStatusPage` (dev), `AiTestHubPage` (dev), `GuidedOnboardingPage` (dup Onboarding).
- **Filtri sx orfani da eliminare**: `CodaAI`, `Circuit`, `Outgoing`, `Attivita`, `ABTest`, `Workspace`, `Inbox` FiltersSection (non cablati).

## 5. Piano di esecuzione (fasi)

**Fase A — Fondamenta del contratto** (no regressioni visibili)
- Creare `pageContract.ts` (registry path→config).
- Creare `StandardPageFrame` (header in-mask + slot AI + slot filtri + slot workflow).
- Refactor `ContextFiltersRail` per leggere `pageContract.filters` invece dell'if/else.
- Creare `WorkflowRail` (legge `pageContract.workflow`), affiancato a `MissionDrawer` (deprecato gradualmente).

**Fase B — Uniformazione menu**
- Derivare `NavMenuPopover` dai 7 gruppi del contract; rimuovere duplicazioni `SECONDARY_NAV`/`EXPANDABLE_MAIN_NAV` ridondanti.
- Breadcrumb da contract.

**Fase C — Consolidamento hub** (uno per turno, con redirect dei vecchi path)
- Email Lab → Prompt Lab → Agenti → Analytics → Acquisizione. Ogni vecchia maschera diventa una tab; vecchie rotte → `Navigate` redirect.

**Fase D — Bonifica**
- Rimuovere maschere fascia 14–0 e filtri orfani; aggiornare `routes.tsx`, `navConfig`, `registry`, test smoke `08-v2-navigation`.

**Fase E — Cablaggio workflow/filtri per le pagine core**
- Popolare `workflow` (azioni, suggerimenti, scorciatoie) e `filters` per le 11 pagine core.

### Note tecniche
- Le speciali (Command/Cockpit/Campagne) **mantengono il contenuto**; cambia solo il guscio (header AI, tabs, rail) per coerenza.
- Ogni rimozione passa da redirect per non rompere bookmark/deep-link e i test E2E in `e2e/smoke/08-v2-navigation.spec.ts` (vanno aggiornati gli array di rotte).
- Zero modifiche a logica di business: solo presentazione/navigazione.

## 6. Output atteso
Sistema con un solo pattern di pagina: menu chiaro a 7 aree, filtri sempre a sinistra (o nascosti), workflow sempre a destra (o nascosti), AI sempre raggiungibile in cima alla maschera, ~25 maschere in meno per duplicazione/deprecazione.

Confermi e procedo autonomamente dalla Fase A?