# Mappa moduli target — Navigator / TMWE Partner Connect

Documento di riferimento (non vincolante a runtime) per la migrazione progressiva verso una
Modular Event-Driven Platform. Nessun confine è ancora imposto dal build: lo script
`scripts/audit-module-boundaries.mjs` misura soltanto lo stato attuale.

## Moduli

| Modulo | UI/pagine | Logica | Dati principali | Edge Functions |
|---|---|---|---|---|
| CRM | Contacts, CRM, Prospect, BusinessCards, Cestinone | components/contacts, prospects | partners, partner_contacts, imported_contacts, prospects, business_cards | deduplicate-*, merge/harmonize |
| Sales Intelligence | Pipeline, Deals, Kanban, Analytics, Kpi | scoring/lead | deals, deal_activities, activities | calculate-*, analyze-* |
| Email Client | Inbox, Comms, FunnemailInbox, EmailDownload | components/email, email-intelligence | channel_messages, email_sync_*, email_attachments | email-*, imap-*, funnemail-* |
| Marketing Automation | Outreach, Campaigns, EmailForge, Composer | components/outreach, campaigns | outreach_*, email_campaign_queue, ab_tests | send-*, campaign-* |
| AI Platform | PromptLab, KBSupervisor, AILab, TokenCockpit | v2/ai, lib/ai | kb_entries, prompt_*, ai_memory, ai_*_log | ai-*, kb-*, prompt-* |
| Agent Framework | Agents, Missions, AgentTasks, Autopilot | v2/agent | agents, agent_*, missions, mission_actions | agent-*, agentic-* |
| Research Engine | DeepSearch, RA*, Explore | scraping/deep search | scrape_cache, directory_cache, sherlock_* | scrape-*, *-enrichment, ai-deep-search-helper |
| Partner Management | Network, PartnerHub, Globe, TmweClients | components/partners | partners, partner_services, tmwe_* | tmwe-* |
| Operational Dashboard | Dashboard, Cockpit, Observability, Telemetry, Diagnostics | v2/observability | edge_metrics, cron_runs, app_error_logs | health/monitor/* |
| Core Platform | Auth, layout, routing, design system | v2/core, components/ui, lib | authorized_users, profiles, app_settings | _shared/* |

## Regole di confine (obiettivo, non ancora enforced)

1. Ogni modulo possiede le proprie tabelle: nessun altro modulo le legge/scrive direttamente.
2. L'accesso ai dati passa sempre da un DAL (`src/data/**`, `src/v2/io/**`), mai da UI o hook.
3. Nessuna dipendenza bidirezionale: `src/components/**` non deve importare `@/v2/**`.
4. `components/ui` e `lib/utils` appartengono al Core Platform: import liberi.
5. Cross-module sincrono solo se necessario; altrimenti eventi/job (vedi `service-suite.md`).

## Debito misurato (baseline 2026-08-09)

Vedi output di `node scripts/audit-module-boundaries.mjs`.