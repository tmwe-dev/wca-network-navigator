# Round C — Lab Hub unificato (tutti i test in un'unica pagina + config)

## SC:CLASSIFY (Codex)
- **Intento:** consolidare TUTTE le pagine di test/lab/analisi/verifica/grafici/QA in `/v2/lab`, governate da **un singolo file di config** (`src/v2/config/labTabs.ts`) con UNA riga per tab.
- **Tipo cambio:** UI + routing. **Zero modifiche** a edge functions, AI, business logic, DB.
- **Nodo critico toccato:** routing (aliases di redirect). Mappa impatto sotto.

## Audit del sistema — pagine "lab-style" oggi sparse

Già in `/v2/lab` (7): Scenari AI, E2E Smoke, Diagnostica, Telemetria, Observability, Extensions, Design System.

**FUORI** dal Lab oggi (le porto dentro):

| Area | Pagina attuale | Cosa fa |
|------|----------------|---------|
| Email | `/v2/email-lab` (EmailLabPage) | Round A iterazioni email + Round B simulazione Funnemail |
| Email | `/v2/ai-lab` → AILabPage | Scenari generate/improve email |
| Logs | `/v2/ai-interactions-log` | Log AI con thumbs feedback |
| Traces | `/v2/pipeline-traces` | Timeline live stage edge functions |
| Prompts | `/v2/settings/prompt-lab` (PromptLabPage) | Simulator + Personas + Capabilities |
| Prompts | `/v2/prompt-lab/catalog` | Catalogo prompt operativi |
| Prompts | `/v2/prompt-lab/tests` | Test regressione prompt |
| Prompts | `/v2/prompt-lab/atlas` | Mappa agenti |
| Prompts | `/v2/prompt-lab/suggestions` | Review suggerimenti |
| Prompts | `/v2/prompt-lab/proposals` | Review proposte |
| Prompts | `/v2/settings/prompt-reader` | Reader prompt |
| Voice | `/v2/settings/brand-voice` | Audit brand voice |
| Health | `/v2/settings/health` | System health |
| Alerts | `/v2/settings/alert-routing` | Routing alert |
| Token | `/v2/token-cockpit` | Cockpit utilizzo AI |

## Architettura proposta

### 1. Nuovo file di config — UNA riga per tab

`src/v2/config/labTabs.ts` (NUOVO):

```ts
export type LabTabGroup = "tests" | "prompts" | "observability" | "design";

export interface LabTabConfig {
  id: string;            // slug querystring (?tab=...)
  label: string;
  icon: LucideIcon;
  group: LabTabGroup;
  loader: () => Promise<{ default: ComponentType }>;
  legacyPath?: string;   // path canonico esistente, se va anche standalone
}

export const LAB_TABS: readonly LabTabConfig[] = [
  // ─── TESTS ───
  { id: "scenari",      label: "Scenari AI",     group: "tests", icon: FlaskConical, loader: () => import("@/v2/ui/pages/AiTestHubPage").then(m => ({ default: m.AiTestHubPage })) },
  { id: "ai-lab",       label: "AI Lab Email",   group: "tests", icon: Beaker, loader: () => import("@/v2/ui/pages/AILabPage") },
  { id: "email-lab",    label: "Email Lab",      group: "tests", icon: Mail, loader: () => import("@/v2/ui/pages/EmailLabPage").then(m => ({ default: m.EmailLabPage })), legacyPath: "/v2/email-lab" },
  { id: "extensions",   label: "Extensions",     group: "tests", icon: Puzzle, loader: () => import("@/components/test-extensions/TestExtensionsView").then(m => ({ default: m.TestExtensionsContent })) },
  { id: "e2e",          label: "E2E Smoke",      group: "tests", icon: Activity, loader: () => import("@/v2/ui/pages/E2EStatusPage").then(m => ({ default: m.E2EStatusPage })) },

  // ─── PROMPTS ───
  { id: "prompt-lab",       label: "Prompt Lab",   group: "prompts", icon: Wand, loader: () => import("@/v2/ui/pages/PromptLabPage").then(m => ({ default: m.PromptLabPage })) },
  { id: "prompt-catalog",   label: "Catalog",      group: "prompts", icon: BookOpen, loader: () => import("@/v2/ui/pages/PromptCatalogPage").then(m => ({ default: m.PromptCatalogPage })) },
  { id: "prompt-tests",     label: "Regression",   group: "prompts", icon: TestTube, loader: () => import("@/v2/ui/pages/PromptTestsPage").then(m => ({ default: m.PromptTestsPage })) },
  { id: "prompt-atlas",     label: "Atlas",        group: "prompts", icon: Map, loader: () => import("@/v2/ui/pages/AgentAtlasPage").then(m => ({ default: m.AgentAtlasPage })) },
  { id: "prompt-suggest",   label: "Suggestions",  group: "prompts", icon: Lightbulb, loader: () => import("@/v2/ui/pages/SuggestionsReviewPage").then(m => ({ default: m.SuggestionsReviewPage })) },
  { id: "prompt-proposals", label: "Proposals",    group: "prompts", icon: GitBranch, loader: () => import("@/v2/ui/pages/ProposalsReviewPage").then(m => ({ default: m.ProposalsReviewPage })) },
  { id: "prompt-reader",    label: "Reader",       group: "prompts", icon: FileText, loader: () => import("@/v2/ui/pages/PromptReaderPage").then(m => ({ default: m.PromptReaderPage })) },
  { id: "brand-voice",      label: "Brand Voice",  group: "prompts", icon: Mic, loader: () => import("@/v2/ui/pages/BrandVoicePage").then(m => ({ default: m.BrandVoicePage })) },

  // ─── OBSERVABILITY ───
  { id: "diagnostica",     label: "Diagnostica",      group: "observability", icon: Stethoscope, loader: () => import("@/v2/ui/pages/DiagnosticsPage").then(m => ({ default: m.DiagnosticsPage })) },
  { id: "telemetria",      label: "Telemetria",       group: "observability", icon: BarChart3, loader: () => import("@/v2/ui/pages/TelemetryPage").then(m => ({ default: m.TelemetryPage })) },
  { id: "observability",   label: "Observability",    group: "observability", icon: Eye, loader: () => import("@/v2/ui/pages/ObservabilityPage").then(m => ({ default: m.ObservabilityPage })) },
  { id: "health",          label: "System Health",    group: "observability", icon: HeartPulse, loader: () => import("@/v2/ui/pages/SystemHealthPage").then(m => ({ default: m.SystemHealthPage })) },
  { id: "alert-routing",   label: "Alert Routing",    group: "observability", icon: BellRing, loader: () => import("@/v2/ui/pages/AlertRoutingPage").then(m => ({ default: m.AlertRoutingPage })) },
  { id: "ai-log",          label: "AI Interactions",  group: "observability", icon: MessageSquare, loader: () => import("@/v2/ui/pages/AiInteractionLogPage").then(m => ({ default: m.AiInteractionLogPage })) },
  { id: "pipeline-traces", label: "Pipeline Traces",  group: "observability", icon: GitCommit, loader: () => import("@/v2/ui/pages/PipelineTracesPage").then(m => ({ default: m.PipelineTracesPage })) },
  { id: "token-cockpit",   label: "Token Cockpit",    group: "observability", icon: Coins, loader: () => import("@/v2/ui/pages/TokenCockpitPage").then(m => ({ default: m.TokenCockpitPage })) },

  // ─── DESIGN ───
  { id: "design", label: "Design System", group: "design", icon: Palette, loader: () => import("@/v2/ui/pages/DesignSystemPreviewPage").then(m => ({ default: m.DesignSystemPreviewPage })) },
];
```

**Aggiungere un nuovo test = aggiungere UNA riga qui.**

### 2. `LabPage.tsx` refactor (no business logic, solo presentazione)

```text
┌─────────────────────────────────────────────────────────┐
│ PageTitleHeader: "Lab & Verifiche"                      │
├─────────────────────────────────────────────────────────┤
│ [Tests]  [Prompts]  [Observability]  [Design]    ← group selector
├─────────────────────────────────────────────────────────┤
│ {tabs del gruppo attivo come pillole orizzontali}       │
├─────────────────────────────────────────────────────────┤
│ <Suspense + ErrorBoundary>                              │
│   <ComponenteAttivo />                                  │
│ </Suspense>                                             │
└─────────────────────────────────────────────────────────┘
```

- Deep-link: `/v2/lab?group=prompts&tab=prompt-catalog`
- Default: `group=tests`, `tab=scenari`
- Group switch resetta `tab` al primo del gruppo
- Persistenza ultima tab in `localStorage` (non blocca, solo preferenza)

### 3. Routing — aliases per non rompere link esistenti

`src/v2/routes.tsx` modifiche:
- `/v2/email-lab` → `<Navigate to="/v2/lab?group=tests&tab=email-lab" replace />`
- `/v2/ai-test-hub` → `?group=tests&tab=scenari`
- `/v2/ai-lab` → `?group=tests&tab=ai-lab`
- `/v2/pipeline-traces` → `?group=observability&tab=pipeline-traces`
- `/v2/ai-interactions-log` → `?group=observability&tab=ai-log`
- `/v2/prompt-lab/catalog`, `/tests`, `/atlas`, `/suggestions`, `/proposals` → mappati al rispettivo tab del gruppo Prompts
- `/v2/settings/prompt-lab` → `?group=prompts&tab=prompt-lab`
- `/v2/settings/prompt-reader` → `?group=prompts&tab=prompt-reader`
- `/v2/settings/brand-voice` → `?group=prompts&tab=brand-voice`
- `/v2/settings/diagnostics`, `/telemetry`, `/observability`, `/health`, `/alert-routing` → group `observability`
- `/v2/token-cockpit` → `?group=observability&tab=token-cockpit`

I componenti restano importabili individualmente (non li tocco): vivono sia standalone via redirect sia dentro il Lab.

### 4. Sidebar / menu (`AppSidebar` o equivalente)
Sostituire le N voci sparse con UNA voce **"Lab & Verifiche"** che apre `/v2/lab`. (Un'unica modifica nel componente sidebar V2.)

## File creati
- `src/v2/config/labTabs.ts` (la "config con una riga per tab")

## File modificati
- `src/v2/ui/pages/LabPage.tsx` (legge `LAB_TABS` invece dei 7 hardcoded)
- `src/v2/routes.tsx` (aliases di redirect + commento "vedi labTabs.ts")
- Sidebar V2 (1 voce "Lab" al posto di N)

## Codex Cobra checklist
- **SC:DEFENSE:** zero edit a edge AI, zero edit a `check-inbox`/IMAP, zero AI invocation nuova, zero migration DB.
- **SC:ROLLBACK:** ripristinabile rimuovendo `labTabs.ts` e rimettendo i 7 tab hardcoded; redirect path eliminabili senza side-effect.
- **SC:DATA:** nessuna scrittura DB, nessun side-effect business.
- **SC:VERB:** ogni rotta vecchia continua a funzionare (Navigate replace), bookmark utenti preservati, tab attiva via querystring.
- **SC:ANTI:** no refactor opportunistici dentro le pagine importate (le carico as-is); no rinomine; no dedup di logica.
- **SC:CHANGELOG:** changelog finale + memoria `mem://architecture/lab-hub-config-driven`.

## Out of scope (rimandato)
- Rinominare/spostare le pagine sorgente.
- Unificare gli store/hook duplicati tra le pagine.
- Aggiungere nuove tab non già presenti come pagina.
- Dashboard analitiche cross-tab.

## Check pre-"fatto"
- `LAB_TABS` ha tutte le 22 voci, raggruppate in 4 group.
- `/v2/lab` apre, group switcher e tab funzionano, deep-link querystring rispettato.
- Tutti i path legacy reindirizzano (test rapido sui 12 alias principali).
- Build passa, nessun import rotto, nessun any nuovo.
- Sidebar mostra una sola voce "Lab & Verifiche".
