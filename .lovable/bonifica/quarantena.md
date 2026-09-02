# Quarantena (Fase 4) — registro pezzi in osservazione

Criterio dichiarato ORA: **finestra 30 giorni** (2026-09-02 → 2026-10-02).
Uscita: se alla scadenza il pezzo non risulta in `usage_events` (route/feature) E nessun consumatore
emerge dalla Lente 3, passa a Fase 5 con commit di sola sottrazione. Se viene chiamato → VIVO, si
documenta il consumatore scoperto.

Meccanismo di osservazione:
- Pagine/rotte: coperte automaticamente da `useRouteUsage` (eventi `route`).
- Edge function: `trackUsage(name, "edge")` da `_shared/usageTrack.ts` (rollout progressivo, mai bloccante).
- Componenti sospetti richiamabili a runtime: `trackUsage("<nome>", "quarantine")` nel punto di mount.

Lente 1 riproducibile: `node scripts/bonifica/orfani.mjs` (grafo import reale da `src/main.tsx` e `src/App.tsx`,
alias `@/`, import dinamici inclusi). Misura del 2026-09-02: 2020 file, 1707 raggiunti, 336 candidati orfani.

## Revisione 2026-09-02 — falsi orfani espulsi dalla quarantena

Il lotto Q1 iniziale proveniva dall'audit statico precedente. Rimisurato con il grafo import reale,
**16 dei 20 pezzi risultano raggiungibili**: erano falsi orfani. Nessuno di essi va toccato.

| Pezzo | Prova del contrario | Esito |
| ----- | ------------------- | ----- |
| `src/components/CommandPalette.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/admin/SystemHealthDashboard.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agenda/AgendaBulkBar.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agenda/AgendaCardView.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agenda/AgendaListView.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentChat.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentClientList.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentKnowledgeBase.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentOperationsDashboard.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentPromptEditor.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentTaskList.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentTerritoryConfig.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentToolSelector.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/AgentVoiceConfig.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/agents/CreateAgentDialog.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |
| `src/components/ai-arena/ContactCard3D.tsx` | raggiunto dal grafo import a partire da `src/main.tsx` | VIVO — uscito dalla quarantena |

## Lotto Q1 (rivisto) — 20 candidati confermati non raggiunti

| # | Pezzo | Inizio | Scadenza | Esito |
| - | ----- | ------ | -------- | ----- |
| Q1.1 | `src/components/agenda/ActivitiesTab.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.2 | `src/components/agents/AgentCard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.3 | `src/components/ai-control/AIAutomationDashboard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.4 | `src/components/ai-control/CostControlPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.5 | `src/components/agents/AgentSignatureConfig.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.6 | `src/components/ai-control/AIGeneratedActivitiesPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.7 | `src/components/ai-control/CostDashboardWidget.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.8 | `src/components/ai-control/DecisionLogPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.9 | `src/components/ai-control/GlobalAIAutomationPause.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.10 | `src/components/ai-control/LearningDashboard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.11 | `src/components/ai-control/LinkedInLimitsPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.12 | `src/components/ai-control/OptimusAgentPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.13 | `src/components/ai-control/SupervisorFeedPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.14 | `src/components/campaigns/EmailPreview.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.15 | `src/components/contacts/ContactAIBar.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.16 | `src/components/contacts/ContactCard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.17 | `src/components/contacts/ContactListPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.18 | `src/components/contacts/ContactMergeDialog.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.19 | `src/components/contacts/ContactSegments.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.20 | `src/components/contacts/contactGridLayout.ts` | 2026-09-02 | 2026-10-02 | in osservazione |

Nota: "non raggiunto staticamente" non significa morto. Restano possibili route legacy, mount via
stringa o consumatori esterni. La quarantena sorveglia; nessuno viene toccato prima della scadenza.
Lettura contatori alla scadenza: query su `usage_events` per `kind IN ('route','quarantine')`.

## Riserva

Altri 316 candidati orfani restano in inventario (elenco riproducibile con lo script),
in attesa che la Lente 2 copra un ciclo completo di 30 giorni.
