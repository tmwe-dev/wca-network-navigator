# V2 Migration Status

> Auto-generated: 2026-04-14. Do NOT edit manually — re-run inventory script.

## Summary

| Status | Count |
|--------|-------|
| WRAPPER | 34 |
| NATIVO | 5 |
| PARZIALE | 0 |
| **Total** | **39** |

## Page Inventory

| Pagina v2 | Stato | File v1 linkato | LOC v1 | Dominio | Note |
|---|---|---|---|---|---|
| AIControlCenterPage.tsx | NATIVO | — | — | ai | Implementazione autonoma v2 |
| AILabPage.tsx | WRAPPER | src/pages/AILab.tsx | 437 | ai | Lazy import |
| AcquisizionePartnerPage.tsx | WRAPPER | src/pages/AcquisizionePartner.tsx | 246 | crm | Lazy import |
| AdminUsersPage.tsx | WRAPPER | src/pages/AdminUsers.tsx | 221 | admin | Lazy import |
| AgendaPage.tsx | WRAPPER | src/pages/Agenda.tsx | 69 | productivity | Lazy import |
| AgentChatHubPage.tsx | WRAPPER | src/pages/AgentChatHub.tsx | 343 | ai | Lazy import |
| AgentsPage.tsx | WRAPPER | src/pages/AgentChatHub.tsx | 343 | ai | Shares v1 with AgentChatHubPage |
| CRMPage.tsx | WRAPPER | src/pages/CRM.tsx | 117 | crm | Lazy import |
| CampaignJobsPage.tsx | WRAPPER | src/pages/CampaignJobs.tsx | 197 | outreach | Lazy import |
| CampaignsPage.tsx | WRAPPER | src/pages/Campaigns.tsx | 100 | outreach | Lazy import |
| CockpitPage.tsx | WRAPPER | src/pages/Cockpit.tsx | 179 | crm | Lazy import |
| ContactsPage.tsx | WRAPPER | src/pages/Contacts.tsx | 118 | crm | Lazy import |
| DashboardPage.tsx | WRAPPER | src/pages/SuperHome3D.tsx | 189 | dashboard | Lazy import |
| DeepSearchPage.tsx | WRAPPER | src/pages/Network.tsx | 19 | network | Lazy import, v1 is tiny |
| DiagnosticsPage.tsx | WRAPPER | src/pages/Diagnostics.tsx | 61 | system | Lazy import + extra v2 UI |
| EmailComposerPage.tsx | WRAPPER | src/pages/EmailComposer.tsx | 154 | email | Lazy import |
| EmailDownloadPage.tsx | WRAPPER | src/pages/EmailDownloadPage.tsx | 245 | email | Lazy import |
| EmailIntelligencePage.tsx | NATIVO | — | — | email | Implementazione autonoma v2 |
| GlobePage.tsx | NATIVO | — | — | network | Three.js globe, v2-only |
| GuidaPage.tsx | WRAPPER | src/pages/Guida.tsx | 284 | system | Lazy import |
| ImportPage.tsx | WRAPPER | src/pages/Operations.tsx | 329 | data | Lazy import, maps to Operations v1 |
| InreachPage.tsx | WRAPPER | src/pages/Inreach.tsx | 9 | outreach | Lazy import, v1 is stub |
| KnowledgeBasePage.tsx | WRAPPER | src/pages/StaffDirezionale.tsx | 161 | ai | Lazy import, maps to StaffDirezionale |
| LoginPage.tsx | NATIVO | — | — | auth | Implementazione autonoma v2 |
| MissionBuilderPage.tsx | WRAPPER | src/pages/MissionBuilder.tsx | 43 | outreach | Lazy import |
| NetworkPage.tsx | WRAPPER | src/pages/Network.tsx | 19 | network | Lazy import |
| OnboardingPage.tsx | WRAPPER | src/pages/Onboarding.tsx | 397 | auth | Lazy import |
| OperationsPage.tsx | WRAPPER | src/pages/Operations.tsx | 329 | data | Lazy import |
| OutreachPage.tsx | WRAPPER | src/pages/Outreach.tsx | 84 | outreach | Lazy import |
| ProspectPage.tsx | WRAPPER | src/pages/ProspectCenter.tsx | 228 | crm | Lazy import |
| RACompanyDetailPage.tsx | WRAPPER | src/pages/RACompanyDetail.tsx | 164 | network | Lazy import |
| RADashboardPage.tsx | WRAPPER | src/pages/RADashboard.tsx | 253 | network | Lazy import |
| RAExplorerPage.tsx | WRAPPER | src/pages/RAExplorer.tsx | 320 | network | Lazy import |
| RAScrapingEnginePage.tsx | WRAPPER | src/pages/RAScrapingEngine.tsx | 290 | network | Lazy import |
| ResetPasswordPage.tsx | NATIVO | — | — | auth | Implementazione autonoma v2 |
| SettingsPage.tsx | WRAPPER | src/pages/Settings.tsx | 133 | system | Lazy import |
| SortingPage.tsx | WRAPPER | src/pages/Sorting.tsx | 134 | data | Lazy import |
| StaffPage.tsx | WRAPPER | src/pages/StaffDirezionale.tsx | 161 | ai | Lazy import |
| TelemetryPage.tsx | WRAPPER | src/pages/telemetry/ | — | system | Lazy import, directory |

## Effort Estimate by Domain

| Dominio | Wrappers | Total LOC v1 | Effort |
|---|---|---|---|
| ai | 4 | 1,284 | High |
| crm | 4 | 742 | Medium |
| outreach | 4 | 424 | Medium |
| network | 5 | 1,066 | High |
| email | 2 | 399 | Medium |
| data | 3 | 792 | Medium |
| auth | 1 | 397 | Medium |
| system | 3 | 478 | Medium |
| admin | 1 | 221 | Low |
| dashboard | 1 | 189 | Low |
| productivity | 1 | 69 | Low |
