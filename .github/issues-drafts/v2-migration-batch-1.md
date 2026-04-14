# V2 Migration — Batch 1: AI & Dashboard

## Title
Port AI and Dashboard pages from v1 wrappers to native v2

## Description
These pages are currently thin wrappers around v1 components. They should be re-implemented using the v2 architecture (organisms/templates pattern, v2 hooks, Result types).

## Pages

| Page | v1 Source | LOC | Priority |
|---|---|---|---|
| AILabPage.tsx | AILab.tsx | 437 | High |
| AgentChatHubPage.tsx | AgentChatHub.tsx | 343 | High |
| AgentsPage.tsx | AgentChatHub.tsx | 343 | Medium (shares v1) |
| KnowledgeBasePage.tsx | StaffDirezionale.tsx | 161 | Medium |
| StaffPage.tsx | StaffDirezionale.tsx | 161 | Medium (shares v1) |
| DashboardPage.tsx | SuperHome3D.tsx | 189 | High |

## Effort Estimate
~1,634 LOC to port. Estimated: 3-5 days.

## Acceptance Criteria
- No imports from `src/pages/` remain in these files
- All data fetching uses v2 hooks
- Error handling uses Result pattern
- Components follow organisms/templates structure
