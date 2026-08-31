# Censimento maschere V2 — stato al 2026-08-31

Rilevato automaticamente su `src/v2/ui/pages/*.tsx` (81 file di pagina di primo livello,
più le sottocartelle `agenda/ cestinone/ command/ email-forge/ email-lab/ finder-api/
funnemail-inbox/ kb-supervisor/ prompt-lab/ sections/ telemetry/`, per un totale di 91 moduli pagina).

## Sintesi

| Guscio usato | Pagine | Quota |
| --- | --- | --- |
| `StandardPageFrame` | 2 | 2% |
| `PageShell` | 16 | 20% |
| `PageTitleHeader` | 22 | 27% |
| `GoldenLayout` | 1 | 1% |
| Nessuno (header fatto a mano) | 40 | 50% |

Altri numeri rilevati:

- **205** occorrenze di classi colore Tailwind fuori palette (`text-*-500`, `bg-*-500`, …) in `src/v2`.
- **11** colori esadecimali scritti direttamente nel JSX.
- `index.css` definisce già token semantici (`--background`, `--card`, `--primary`, `--accent`,
  `--success`, `--warning`, `--destructive`, `--info`, `--gold`, `--glass-*`) e **6 temi**
  (`light`, `dark`, `theme-lilac`, `theme-space`, varianti warm). Il problema non è la mancanza
  di token: è che metà delle pagine non li usa.
- `layoutTokens.ts` normalizza altezze (top bar 44px, header pagina 36px, toolbar 36px) e
  z-index, ma nessuna regola di colore o di densità.

## Tabella completa

Legenda colonne: **Guscio** = wrapper attualmente usato · **Righe** = lunghezza file ·
**Fuori palette** = colori hardcoded · **Btn** = `<Button>` nel file (proxy della densità di azioni) ·
**Archetipo** = famiglia di destinazione (vedi `archetipi-pagina.md`).

| Pagina | Guscio | Righe | Fuori palette | Btn | Archetipo |
| --- | --- | --- | --- | --- | --- |
| AIArenaPage | NESSUNO | 60 | 0 | 0 | Full-bleed |
| AILabPage | NESSUNO | 959 | 0 | 3 | Editor |
| AcquisizionePartnerPage | NESSUNO | 317 | 0 | 4 | Elenco→Dettaglio |
| AdminUsersPage | PageShell | 219 | 0 | 2 | Editor |
| AgendaPage | PageTitleHeader | 229 | 0 | 2 | Flusso |
| AgentCapabilitiesPage | NESSUNO | 201 | 0 | 0 | Editor |
| AgentPersonaEditorPage | PageShell | 363 | 0 | 9 | Editor |
| AgentRolesOverviewPage | PageTitleHeader | 235 | 0 | 0 | Hub |
| AgentTasksPage | PageShell | 216 | 0 | 4 | Flusso |
| AgentsPage | PageTitleHeader | 16 | 0 | 0 | Hub |
| AiInteractionLogPage | PageShell | 370 | 0 | 9 | Monitor |
| AiRoutingConfigPage | PageShell | 282 | 11 | 1 | Editor |
| AiTestHubPage | NESSUNO | 391 | 0 | 10 | Hub |
| AlertRoutingPage | PageShell | 230 | 0 | 2 | Editor |
| AnalyticsPage | PageShell | 138 | 0 | 4 | Monitor |
| ApprovazioniPage | PageTitleHeader | 20 | 0 | 0 | Flusso |
| AuthCallbackPage | NESSUNO | 95 | 0 | 0 | Fuori perimetro (auth) |
| BrainPage | NESSUNO | 289 | 0 | 2 | Hub |
| BrandVoicePage | PageShell | 198 | 10 | 0 | Editor |
| CRMPage | NESSUNO | 164 | 0 | 0 | Hub |
| CalendarPage | NESSUNO | 166 | 0 | 1 | Flusso |
| CampaignJobsPage | NESSUNO | 213 | 0 | 3 | Monitor |
| CampaignsPage | NESSUNO | 130 | 0 | 2 | **Full-bleed (escluso)** |
| CestinonePage | PageTitleHeader | 142 | 0 | 4 | Flusso |
| CockpitPage | StandardPageFrame | 274 | 1 | 0 | Monitor |
| CommandPage | PageTitleHeader | 350 | 0 | 0 | Full-bleed (conversazione) |
| CommsPage | StandardPageFrame | 62 | 0 | 0 | Elenco→Dettaglio |
| ContactsPage | Golden | 245 | 0 | 0 | Elenco→Dettaglio |
| DPAPage | PageShell | 174 | 0 | 2 | Editor |
| DashboardPage | PageTitleHeader | 216 | 0 | 0 | Monitor |
| DeepSearchPage | NESSUNO | 279 | 0 | 3 | Flusso |
| DesignSystemPreviewPage | NESSUNO | 150 | 0 | 0 | Hub |
| DiagnosticsPage | PageShell | 68 | 0 | 2 | Monitor |
| DocsPage | PageShell | 254 | 0 | 0 | Hub |
| E2EStatusPage | PageTitleHeader | 193 | 0 | 0 | Monitor |
| EmailComposerPage | PageTitleHeader | 325 | 0 | 6 | Editor |
| EmailDownloadPage | NESSUNO | 281 | 0 | 8 | Flusso |
| EmailForgePage | NESSUNO | 169 | 0 | 1 | Editor |
| EmailIntelligenceOperationsPage | NESSUNO | 127 | 0 | 0 | Monitor |
| EmailIntelligencePage | PageTitleHeader | 224 | 0 | 0 | Monitor |
| EmailLabPage | NESSUNO | 106 | 0 | 2 | Editor |
| EmailStrategiesPage | PageTitleHeader | 477 | 0 | 6 | Editor |
| FinderApiPage | PageTitleHeader | 135 | 0 | 0 | Hub |
| FunnemailInboxPage | PageTitleHeader | 145 | 0 | 0 | Elenco→Dettaglio |
| GlobePage | NESSUNO | 34 | 0 | 0 | **Full-bleed (escluso)** |
| GuidaPage | NESSUNO | 107 | 0 | 0 | Hub |
| GuidedOnboardingPage | NESSUNO | 322 | 0 | 7 | Flusso |
| InreachPage | PageTitleHeader | 17 | 0 | 0 | Elenco→Dettaglio |
| KBSupervisorPage | NESSUNO | 72 | 0 | 0 | Editor |
| KpiPage | PageShell | 177 | 0 | 0 | Monitor |
| LabPage | PageTitleHeader | 116 | 0 | 0 | Hub |
| LandingPage | NESSUNO | 328 | 0 | 5 | Fuori perimetro (pubblica) |
| LoginPage | NESSUNO | 163 | 0 | 0 | Fuori perimetro (auth) |
| MissionBuilderPage | NESSUNO | 79 | 0 | 2 | Editor |
| **MissionsAutopilotPage** | PageShell | 420 | 0 | 6 | **Monitor — prototipo** |
| NetworkPage | PageTitleHeader | 185 | 0 | 0 | Elenco→Dettaglio |
| NotificationsPage | PageShell | 167 | 0 | 3 | Flusso |
| ObservabilityPage | NESSUNO | 378 | 0 | 2 | Monitor |
| OnboardingPage | NESSUNO | 477 | 0 | 4 | Fuori perimetro (onboarding) |
| OperationsPage | NESSUNO | 334 | 0 | 0 | Monitor |
| OutreachPage | PageTitleHeader | 43 | 0 | 0 | Elenco→Dettaglio |
| PipelineTracesPage | PageShell | 484 | 2 | 4 | Monitor |
| PromptCatalogPage | NESSUNO | 263 | 0 | 3 | Elenco→Dettaglio |
| PromptLabPage | NESSUNO | 327 | 0 | 2 | Editor |
| ProspectPage | NESSUNO | 326 | 1 | 0 | Elenco→Dettaglio |
| RACompanyDetailPage | NESSUNO | 223 | 0 | 2 | Elenco→Dettaglio |
| RADashboardPage | NESSUNO | 297 | 1 | 5 | Monitor |
| RAExplorerPage | NESSUNO | 322 | 0 | 1 | Elenco→Dettaglio |
| RAScrapingEnginePage | NESSUNO | 418 | 0 | 4 | Flusso |
| RubricaLinkedInPage | NESSUNO | 110 | 2 | 0 | Elenco→Dettaglio |
| RubricaWhatsAppPage | NESSUNO | 104 | 2 | 0 | Elenco→Dettaglio |
| SettingsPage | PageTitleHeader | 516 | 0 | 0 | Editor |
| SimpleHomePage | NESSUNO | 96 | 0 | 0 | Hub |
| SortingPage | NESSUNO | 181 | 0 | 4 | Flusso |
| StaffPage | NESSUNO | 154 | 0 | 0 | Hub |
| SystemGalaxyPage | NESSUNO | 263 | 1 | 1 | **Full-bleed (escluso)** |
| TelemetryPage | PageShell | 77 | 0 | 0 | Monitor |
| TmweClientsPage | NESSUNO | 132 | 0 | 1 | Elenco→Dettaglio |
| TmweLoginPopupPage | NESSUNO | 54 | 0 | 0 | Fuori perimetro (auth) |
| TokenCockpitPage | NESSUNO | 138 | 0 | 0 | Monitor |

Le pagine nelle sottocartelle (`command/`, `funnemail-inbox/`, `agenda/`, `prompt-lab/`,
`telemetry/`, `finder-api/`, `email-forge/`, `email-lab/`, `kb-supervisor/`, `cestinone/`)
ereditano l'archetipo della loro pagina radice.

## Distribuzione per archetipo

| Archetipo | Pagine (circa) |
| --- | --- |
| Elenco → Dettaglio | 15 |
| Monitor / KPI | 17 |
| Editor / Configurazione | 18 |
| Flusso operativo | 12 |
| Hub di navigazione | 13 |
| Full-bleed (escluso o speciale) | 5 |
| Fuori perimetro (auth/pubbliche) | 5 |

**Conclusione**: 91 maschere si riducono a **5 archetipi da progettare** più i casi speciali.
Il caos percepito non nasce dal numero di funzioni ma dal fatto che ogni pagina reinventa
header, spaziatura, colore e densità.
