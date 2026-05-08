# Lab & Verifiche — Hub unificato

## Obiettivo
Una sola pagina dove fare **tutte** le verifiche operative del sistema: test agenti, diagnostica, smoke E2E, telemetria, prompt regression, simulator, test extension. Niente più caccia al tesoro tra menù diversi.

## Cosa esiste oggi (audit)
Ho mappato 8 aree di test/verifica disseminate nel menù:

| Area | Path attuale | Cosa fa |
|---|---|---|
| AI Test Hub | `/v2/ai-test-hub` | Scenari AI con assertion (nuovo) |
| AI Lab (deprecato) | `/v2/ai-staff/lab` | Vecchi 30 scenari email/outreach |
| Prompt Lab → Simulator | `/v2/settings/prompt-lab` (tab) | Dry-run agente |
| Prompt Lab → Tests | `/v2/settings/prompt-lab` (tab) | Regression prompt operativi |
| Diagnostics | `/v2/settings/diagnostics` | Health DB/edge/auth |
| E2E Status | `/v2/settings/e2e-status` | Smoke flussi end-to-end |
| Telemetry | `/v2/settings/telemetry` | AI request logs, page events |
| Test Extensions | drawer globale | WhatsApp/LinkedIn/FireScrape DOM tests |
| Observability | `/v2/settings/observability` | Metriche edge, errori |
| Design System Preview | `/v2/design-system-preview` | Showcase componenti |

Risultato: 10 voci sparse in 2 gruppi diversi, con sovrapposizioni e nessuna vista unificata.

## Proposta: rinominare `/v2/ai-test-hub` → `/v2/lab` con 6 tab

```text
┌──────────────────────────────────────────────────────────────┐
│  Lab & Verifiche                                             │
├──────────────────────────────────────────────────────────────┤
│ [Scenari AI] [Simulator] [Prompt Tests] [E2E] [Diagnostica]  │
│ [Telemetria] [Extensions] [Design System]                    │
├──────────────────────────────────────────────────────────────┤
│  contenuto del tab attivo                                    │
└──────────────────────────────────────────────────────────────┘
```

Ogni tab è un **embed** della pagina esistente (riuso 1:1 dei componenti, niente duplicazione di logica). Le rotte vecchie restano vive come deep-link e redirect verso il tab corrispondente.

### Tab proposti

1. **Scenari AI** — l'attuale AI Test Hub (runner + editor scenari).
2. **Simulator** — il `SimulatorTab` di Prompt Lab estratto come sub-route.
3. **Prompt Tests** — regression `prompt-test-runner` (oggi nascosto in Prompt Lab).
4. **E2E Smoke** — `E2EStatusPage` embeddata.
5. **Diagnostica** — `DiagnosticsPage` (health DB, edge, auth).
6. **Telemetria** — `TelemetryPage` (AI requests, page events, edge metrics).
7. **Extensions** — `TestExtensionsView` (WA/LI/FireScrape DOM).
8. **Design System** — `DesignSystemPreviewPage` per QA visuale.

### Top bar comune
- **Run all smoke** (lancia in parallelo: scenari AI critici + E2E + diagnostica).
- **Status pill** globale (verde/giallo/rosso) calcolata sull'ultimo run.
- **Filtro per agente/scope** che si propaga a tutti i tab compatibili.

## Modifiche al menù
- Voce nuova: **"Lab & Verifiche"** in cima al gruppo "Intelligence" o sotto "Sistema & Admin".
- Rimuovo dal menù principale: `AI Test Hub`, `Diagnostics`, `E2E Status`, `Telemetry`, `Observability`, `Design System` (restano accessibili via tab e via URL diretto).
- `Prompt Lab` resta separato: è strumento di authoring prompt, non di verifica. I suoi sub-tab "Simulator" e "Prompt Tests" vengono esposti **anche** dentro Lab (stesso componente, due punti d'accesso).

## Cosa NON tocco
- Nessuna modifica a logica di test, edge function, scenari DB, prompt registry.
- Nessuna modifica a `agent-execute`, `ai-test-runner`, `prompt-test-runner`.
- Nessuna deprecazione delle pagine sorgenti: restano per deep-link, ma sparite dal menù.
- Componenti embeddati senza fork: import diretto del default export.

## Dettagli tecnici
- File nuovo: `src/v2/ui/pages/LabPage.tsx` con tab `Tabs` di shadcn e `Suspense + lazy` per ogni sub-page.
- Update: `src/v2/routes.tsx` aggiunge `/v2/lab` e redirect da `/v2/ai-test-hub` → `/v2/lab?tab=scenari`.
- Update: `src/v2/navigation/registry.ts` per nuova voce + rimozioni.
- Stato tab via querystring (`?tab=...`) per deep-link e back/forward.
- Nessuna nuova migrazione DB, nessuna nuova edge function.

## Open question
Vuoi che la voce **"Prompt Lab"** venga inglobata interamente come tab del Lab (authoring + verifica nello stesso posto) o tenuta separata come strumento di authoring?
