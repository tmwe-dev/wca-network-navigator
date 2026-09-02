# Quarantena (Fase 4) — registro pezzi in osservazione

Criterio dichiarato ORA: **finestra 30 giorni** (2026-09-02 → 2026-10-02).
Uscita: se alla scadenza il pezzo non risulta in `usage_events` (route/feature) E nessun consumatore
emerge dalla Lente 3, passa a Fase 5 con commit di sola sottrazione. Se viene chiamato → VIVO, si
documenta il consumatore scoperto.

Meccanismo di osservazione:
- Pagine/rotte: coperte automaticamente da `useRouteUsage` (eventi `route`).
- Edge function: `trackUsage(name, "edge")` da `_shared/usageTrack.ts` (rollout progressivo, mai bloccante).
- Componenti sospetti richiamabili a runtime: `trackUsage("<nome>", "quarantine")` nel punto di mount.

## Lotto Q1 — primi 20 orfani candidati (dall'audit statico)

| # | Pezzo | Inizio | Scadenza | Esito |
| - | ----- | ------ | -------- | ----- |
| Q1.1 | `src/components/CommandPalette.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.2 | `src/components/admin/SystemHealthDashboard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.3 | `src/components/agenda/ActivitiesTab.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.4 | `src/components/agenda/AgendaBulkBar.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.5 | `src/components/agenda/AgendaCardView.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.6 | `src/components/agenda/AgendaListView.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.7 | `src/components/agents/AgentCard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.8 | `src/components/agents/AgentChat.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.9 | `src/components/agents/AgentClientList.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.10 | `src/components/agents/AgentKnowledgeBase.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.11 | `src/components/agents/AgentOperationsDashboard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.12 | `src/components/agents/AgentPromptEditor.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.13 | `src/components/agents/AgentTaskList.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.14 | `src/components/agents/AgentTerritoryConfig.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.15 | `src/components/agents/AgentToolSelector.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.16 | `src/components/agents/AgentVoiceConfig.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.17 | `src/components/agents/CreateAgentDialog.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.18 | `src/components/ai-arena/ContactCard3D.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.19 | `src/components/ai-control/AIAutomationDashboard.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |
| Q1.20 | `src/components/ai-control/CostControlPanel.tsx` | 2026-09-02 | 2026-10-02 | in osservazione |

Nota: questi componenti v1 hanno 0 importer statici ma possono essere raggiunti via route legacy
o lazy import. La quarantena li sorveglia; nessuno viene toccato prima della scadenza.
Lettura contatori alla scadenza: query su `usage_events` per `kind IN ('route','quarantine')`.
