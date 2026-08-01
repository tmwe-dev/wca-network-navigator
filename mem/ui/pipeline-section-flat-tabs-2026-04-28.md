---
name: Pipeline Section - Flat Tabs Cleanup
description: PipelineSection /v2/pipeline/* con 6 tab flat (Contatti CRM, Kanban, Biglietti, Duplicati, Campagne, Agenda). Deals rimosso.
type: feature
---
- Sezione Pipeline (`src/v2/ui/pages/sections/PipelineSection.tsx`) usa SectionTabs con 6 tab senza GoldenHeaderBar duplicato.
- Tab Kanban rende `ContactPipelineView` (lifecycle drag-and-drop su lead_status), non più `CRMPage`.
- Feature Deals dismessa (business logistico non prevedibile): pagine UI/components/test eliminati. `src/data/deals.ts` e `src/hooks/useDeals.ts` ridotti a stub solo per compatibilità con il modulo Calendar (Deal type).
- ChannelFilterBar standardizzato in `src/v2/ui/molecules/ChannelFilterBar.tsx` (Email/WA/LinkedIn/Calls), riutilizzabile in Inbox/Outreach/CRM.
