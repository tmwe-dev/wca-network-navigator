

# Piano Completo — Completamento V2 (Tutto)

Questo piano copre TUTTO il lavoro rimanente per portare la V2 al 100% di parità con la V1, organizzato in 5 fasi sequenziali.

---

## Stato attuale

- **26 pagine V2** esistenti, di cui **10 con query supabase inline** (violazione architettura)
- **11 pagine V1 senza equivalente V2** (escluse Test* e NotFound)
- **8 pagine V2 funzionalmente incomplete** (shell con UI minima)
- **17 hook V2** su 123 V1 (14% copertura)
- **IO layer** copre solo 6 domini (partners, contacts, activities, agents, campaigns, app-settings)

---

## FASE 2A — 11 Pagine Mancanti

Creare le pagine V2 che non esistono affatto, con relativo hook dove serve.

| Pagina | Hook da creare | Componenti da creare |
|--------|---------------|---------------------|
| `AcquisizionePartnerPage` | `useAcquisitionV2` | `AcquisitionPipeline`, `AcquisitionQueue` |
| `AgentChatHubPage` | `useAgentChatV2` | `AgentAvatarCarousel`, `AgentVoiceCall` |
| `ContactsPage` | (usa `useContactsV2` esistente) | `ContactListPanel`, `ContactDetailPanel` |
| `EmailDownloadPage` | `useEmailDownloadV2` | `EmailDownloadMonitor` |
| `RAExplorerPage` | `useRAProspectsV2` | `RAFilterSidebar`, `RAProspectList` |
| `RAScrapingEnginePage` | `useRAScrapingV2` | `RAScrapingControls`, `RAJobMonitor` |
| `RACompanyDetailPage` | (usa `useRAProspectsV2`) | `RACompanyKPI`, `RACompanyContacts` |
| `CampaignJobsPage` | `useCampaignJobsV2` | (inline, pagina semplice) |
| `AdminUsersPage` | `useAdminUsersV2` | (inline, pagina semplice) |
| `OnboardingPage` | `useOnboardingV2` | `OnboardingWizard`, `OnboardingChat` |
| `GuidaPage` | — | `GuidaSection` (riutilizza v1 data) |

**File: ~11 pagine + ~10 hook + ~15 organismi = ~36 file**

---

## FASE 2B — 8 Pagine Shell da Completare

Portare le pagine esistenti ma troppo semplici a parità funzionale con V1.

| Pagina V2 | LOC attuale | Cosa manca |
|-----------|-------------|------------|
| `GlobePage` | 44 | Portare `SuperHome3D` integralmente (moduli navigazione, cards, briefing) |
| `SortingPage` | 60 | CRUD regole, toggle attivazione, drag-to-reorder |
| `OperationsPage` | 73 | Tab multi-operazione, alias generator, job control play/pause |
| `MissionBuilderPage` | 96 | Wizard step-by-step, assegnazione agente, salvataggio missione |
| `RADashboardPage` | 105 | Grafici, statistiche per network, link a RA pages |
| `DeepSearchPage` | 74 | Filtri avanzati, ricerca KB, deep search AI via edge function |
| `StaffPage` | 131 | Daily briefing AI, KB management, workspace docs |
| `CampaignsPage` | 222 | Portare da v1 Campaigns.tsx integralmente (GoalWizard, scheduling) |

**Hook aggiuntivi:** `useSortingV2`, `useOperationsV2`, `useMissionBuilderV2`, `useDeepSearchV2`, `useDailyBriefingV2`

**File: ~8 pagine riscrivere + ~5 hook + ~12 organismi = ~25 file**

---

## FASE 2C — Hook Critici Mancanti (~25 hook)

Hook che servono trasversalmente a più pagine, non solo a una specifica.

| Hook | Usato da |
|------|----------|
| `useDownloadJobsV2` | Operations, Acquisition, RADashboard |
| `useCockpitLogicV2` | Cockpit, Agents |
| `useKbEntriesV2` | KnowledgeBase, Staff, AI Lab |
| `useBusinessCardsV2` | Network, CRM |
| `useContactGroupsV2` | Contacts, CRM |
| `useCreditsV2` | Settings/Subscription, Telemetry |
| `useChannelMessagesV2` | Outreach, Inreach |
| `useOutreachQueueV2` | Outreach, EmailComposer |
| `useEmailCampaignQueueV2` | Campaigns, CampaignJobs |
| `useLinkedInFlowV2` | Network, Contacts, Outreach |
| `useWhatsAppBridgeV2` | Outreach, Contacts |
| `useContinuousSpeechV2` | AgentChatHub, Staff |
| `useAiVoiceV2` | AgentChatHub, Staff |
| `useProspectsV2` | ProspectPage, RAExplorer |
| `useBlacklistV2` | CRM, Contacts |
| `useHoldingPatternV2` | Outreach, Inreach |
| `useEmailSyncV2` | EmailDownload, Inreach |
| `useWcaSyncV2` | Acquisition, Network |
| `useAgentTasksV2` | Agents, Cockpit, Missions |
| `useWorkspaceDocsV2` | Staff, KnowledgeBase |
| `useContactCompletenessV2` | CRM, Contacts |
| `useReminderV2` | Agenda |
| `useUnreadCountsV2` | Layout sidebar badges |
| `usePendingTaskCountV2` | Layout sidebar badges |
| `useTrackActivityV2` | Globale (analytics) |

**File: ~25 hook**

---

## FASE 2D — IO Layer Completamento

Aggiungere i moduli IO mancanti per i domini non coperti.

| Modulo IO | Queries | Mutations | Schema |
|-----------|---------|-----------|--------|
| `download-jobs` | list, byId, byCountry | create, updateStatus | Zod schema |
| `business-cards` | list, byPartner | create, updateMatch | Zod schema |
| `kb-entries` | list, search | create, update, delete | Zod schema |
| `email-messages` | list, byContact | create, markRead | Zod schema |
| `ra-prospects` | list, byAteco, byRegion | create, updateStatus | Zod schema |
| `sorting-rules` | list | create, update, reorder | Zod schema |
| `credit-transactions` | list, balance | — | Zod schema |
| `operators` | list | create, toggleAdmin | Zod schema |
| `workspace-docs` | list | create, update, delete | Zod schema |
| `outreach-queue` | list, pending | enqueue, dequeue | Zod schema |

**File: ~10 query + ~10 mutation + ~10 schema + ~10 mapper = ~40 file**

---

## FASE 2E — Correzione Violazioni Architettura

Rimuovere tutte le query `supabase.*` inline dalle 10 pagine V2 che le contengono, spostando la logica nei hook che a loro volta usano il layer IO.

| Pagina | Violazioni | Correzione |
|--------|-----------|------------|
| `CampaignsPage` | 5 calls | Muovere in `useCampaignsV2` (estendere) |
| `CockpitPage` | 2 calls | Creare `useCockpitLogicV2` |
| `DeepSearchPage` | 3 calls | Creare `useDeepSearchV2` |
| `MissionBuilderPage` | 2 calls | Creare `useMissionBuilderV2` |
| `AILabPage` | 1 call | Creare `useAILabV2` |
| `GlobePage` | 1 call | Usare `useCountryStatsV2` esistente |
| `InreachPage` | 1 call | Creare `useInreachV2` |
| `OutreachPage` | 1 call | Usare `useOutreachQueueV2` |
| `ProspectPage` | 1 call | Usare `useProspectsV2` |
| `StaffPage` | 1 call | Creare `useStaffV2` |

Aggiungere anche il routing per le 11 nuove pagine in `routes.tsx`.

---

## FASE 2F — Integrazione Finale e Pulizia

1. Aggiornare `routes.tsx` con le 11 nuove pagine + rotte RA nidificate
2. Aggiornare la sidebar/navigation nel `AuthenticatedLayout` per mostrare tutte le voci
3. Aggiungere Error Boundaries per ogni modulo lazy-loaded
4. Verificare `npx tsc --noEmit` con zero errori
5. Verificare zero `any` in tutto `src/v2/`
6. Verificare zero `supabase.` diretto nelle pagine

---

## Riepilogo Numeri

| Fase | File nuovi | File modificati |
|------|-----------|----------------|
| 2A — Pagine mancanti | ~36 | 1 (routes) |
| 2B — Shell da completare | ~25 | 8 (pagine) |
| 2C — Hook critici | ~25 | 0 |
| 2D — IO layer | ~40 | 0 |
| 2E — Fix violazioni | 0 | ~12 |
| 2F — Integrazione | 0 | ~3 |
| **TOTALE** | **~126 file** | **~24 file** |

L'ordine di esecuzione e: **2D → 2C → 2A → 2B → 2E → 2F** (IO layer prima, poi hook, poi pagine, poi fix, poi pulizia). Questo garantisce che ogni pagina creata possa gia usare hook e IO corretti senza violare l'architettura.

