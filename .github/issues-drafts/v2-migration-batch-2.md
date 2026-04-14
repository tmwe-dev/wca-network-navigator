# V2 Migration — Batch 2: CRM & Outreach

## Title
Port CRM and Outreach pages from v1 wrappers to native v2

## Description
Core business pages that need native v2 implementation for full feature parity and architectural consistency.

## Pages

| Page | v1 Source | LOC | Priority |
|---|---|---|---|
| AcquisizionePartnerPage.tsx | AcquisizionePartner.tsx | 246 | High |
| CRMPage.tsx | CRM.tsx | 117 | High |
| CockpitPage.tsx | Cockpit.tsx | 179 | High |
| ContactsPage.tsx | Contacts.tsx | 118 | Medium |
| ProspectPage.tsx | ProspectCenter.tsx | 228 | Medium |
| CampaignJobsPage.tsx | CampaignJobs.tsx | 197 | Medium |
| CampaignsPage.tsx | Campaigns.tsx | 100 | Low |
| OutreachPage.tsx | Outreach.tsx | 84 | Medium |
| MissionBuilderPage.tsx | MissionBuilder.tsx | 43 | Low |
| InreachPage.tsx | Inreach.tsx | 9 | Low (stub) |

## Effort Estimate
~1,321 LOC to port. Estimated: 3-4 days.

## Acceptance Criteria
- No imports from `src/pages/` remain in these files
- All data fetching uses v2 hooks with queryKeys registry
- Components follow organisms/templates structure
