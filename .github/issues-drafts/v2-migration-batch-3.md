# V2 Migration — Batch 3: Network, Email, Data & System

## Title
Port remaining wrapper pages from v1 to native v2

## Description
Infrastructure and utility pages. Many are small or stubs, making them good candidates for quick wins.

## Pages

| Page | v1 Source | LOC | Priority |
|---|---|---|---|
| RADashboardPage.tsx | RADashboard.tsx | 253 | High |
| RAExplorerPage.tsx | RAExplorer.tsx | 320 | High |
| RAScrapingEnginePage.tsx | RAScrapingEngine.tsx | 290 | Medium |
| RACompanyDetailPage.tsx | RACompanyDetail.tsx | 164 | Medium |
| NetworkPage.tsx | Network.tsx | 19 | Low (tiny) |
| DeepSearchPage.tsx | Network.tsx | 19 | Low (tiny) |
| EmailComposerPage.tsx | EmailComposer.tsx | 154 | Medium |
| EmailDownloadPage.tsx | EmailDownloadPage.tsx | 245 | Medium |
| ImportPage.tsx | Operations.tsx | 329 | Medium |
| OperationsPage.tsx | Operations.tsx | 329 | Medium (shares v1) |
| SortingPage.tsx | Sorting.tsx | 134 | Low |
| OnboardingPage.tsx | Onboarding.tsx | 397 | High |
| AdminUsersPage.tsx | AdminUsers.tsx | 221 | Low |
| SettingsPage.tsx | Settings.tsx | 133 | Low |
| GuidaPage.tsx | Guida.tsx | 284 | Low |
| DiagnosticsPage.tsx | Diagnostics.tsx | 61 | Low |
| TelemetryPage.tsx | telemetry/ | — | Low |
| AgendaPage.tsx | Agenda.tsx | 69 | Low |

## Effort Estimate
~3,421 LOC to port. Estimated: 5-8 days.

## Acceptance Criteria
- No imports from `src/pages/` remain in these files
- All data fetching uses v2 hooks with queryKeys registry
- Components follow organisms/templates structure
