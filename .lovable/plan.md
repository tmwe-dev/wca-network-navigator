# Piano di migrazione verso Modular Event-Driven Platform (Fase 0: ricognizione)

Nessuna modifica al codice e' stata fatta. Questa e' la fotografia read-only e il piano prudente.

## 1. Fotografia struttura attuale

- `src/v2/` (717 file): architettura corrente. `ui/` 498, `io/` 67 (DAL v2), `hooks/` 47, `services/` 30, `core/` 28, `agent/` 19, `observability/` 6, `bridge/` 5.
- `src/components/` (640 file): quasi tutto ancora vivo e **consumato da v2** (non e' "V1 morto"). Top: `ui/` 61 (design system), `settings/` 50, `outreach/` 49, `email-intelligence/` 43, `global/` 42, `contacts/` 34, `partners/` 26.
- `src/data/` (374 file, di cui 130 test): DAL legacy tuttora autorevole per molte entita' (kbEntries, agents, partners, contacts, prompts).
- `src/hooks/` 226 file, `src/lib/` 151.
- `src/pages/` contiene **1 solo file** (`OAuthConsent.tsx`): il routing V1 a pagine e' gia' stato smantellato.
- Routing unico: `src/v2/routes.tsx`, ~150 rotte, 78 pagine in `src/v2/ui/pages`.
- Backend: 150 Edge Functions, 200+ tabelle.

Conclusione chiave: non esiste piu' un "V1 applicativo" parallelo; esiste un **layer legacy condiviso** (`src/components`, `src/hooks`, `src/data`, `src/lib`) usato dal v2. La deprecazione va fatta per *pezzi*, non per cartelle.

## 2. Inventario residuo V1 e classificazione

- **Sicuramente morto (nessun riferimento trovato)**: `components/import/AdvancedActivityForm.tsx`, `components/import/CompactContactCard.tsx`, `components/operations/ai/ActivePlansBadge.tsx`, `components/outreach/ABTestResults.tsx`, `components/outreach/CodaAITab.tsx`, `components/outreach/HoldingPatternCommandCenter.tsx`, `components/outreach/SchedulingTab.tsx`, `components/partners/CountryWorkbenchFilters.tsx`, `components/partners/CountryWorkbenchTable.tsx`, `components/shared/ContentPicker.tsx`, `components/prototypes/shared/*` (3 file), `hooks/useActionPanelLogic.ts`, `hooks/useAiVoice.ts`, `hooks/useNetworkConfigs.ts`, `hooks/emailIntelligence/useEmailClassificationsRepo.ts`.
- **Probabilmente morto (da verificare a mano)**: `components/prototypes/**`, `components/test-extensions/**`, `public/proposals.html`, pagine lab/preview non raggiungibili dal menu.
- **Ancora usato (NON toccare ora)**: `components/ui`, `components/global`, `components/settings`, `components/outreach`, `components/email-intelligence`, tutti i moduli `src/data/*` referenziati da v2.
- **Incerto**: rotte alias duplicate (`crm/contacts` vs `contacts`, `comms` vs `communicate/*` vs `inbox`/`email`), da misurare con analytics/log prima di rimuovere.

## 3. Mappa verso i moduli target

| Modulo | UI/pagine | Logica | Dati principali | Edge Functions |
|---|---|---|---|---|
| CRM | Contacts, CRM, Prospect, BusinessCards, Cestinone | components/contacts, prospects | partners, partner_contacts, imported_contacts, prospects, business_cards | deduplicate-*, merge/harmonize |
| Sales Intelligence | Pipeline, Deals, Kanban, Analytics, Kpi | scoring/lead | deals, deal_activities, activities | calculate-*, analyze-* |
| Email Client | Inbox, Comms, FunnemailInbox, EmailDownload | components/email, email-intelligence | channel_messages, email_sync_*, email_attachments | email-*, imap-*, funnemail-* |
| Marketing Automation | Outreach, Campaigns, EmailForge, Composer | components/outreach, campaigns | outreach_*, email_campaign_queue, ab_tests | send-*, campaign-* |
| AI Platform | PromptLab, KBSupervisor, AILab, TokenCockpit | v2/ai, lib/ai, prompt/KB/memory | kb_entries, prompt_*, ai_memory, ai_*_log | ai-*, kb-*, prompt-* |
| Agent Framework | Agents, Missions, AgentTasks, Autopilot | v2/agent | agents, agent_*, missions, mission_actions | agent-*, agentic-* |
| Research Engine | DeepSearch, RA*, Explore | scraping/deep search | scrape_cache, directory_cache, sherlock_* | scrape/deep-search/* |
| Partner Management | Network, PartnerHub, Globe, TmweClients | components/partners | partners, partner_services, tmwe_* | tmwe-* |
| Operational Dashboard | Dashboard, Cockpit, Observability, Telemetry, Diagnostics | v2/observability | edge_metrics, cron_runs, app_error_logs | health/monitor/* |
| Core Platform | Auth, layout, routing, design system | v2/core, components/ui, lib | authorized_users, profiles, app_settings | _shared/* |

## 4. Dipendenze cross-module attuali (misurate)

- `src/v2/**` importa il legacy 900+ volte: 553 da `components/ui` (accettabile: design system -> Core), il resto da `components/*` verticali (settings 23, guida 17, global 13, outreach 11, operations 9, email 9) e da `src/data/*` (kbEntries 22, harmonizeRuns 14, appSettings 13, agents 11).
- 53 file legacy importano `@/v2/**` -> **dipendenze bidirezionali**: il rischio piu' alto.
- 122 file fuori da `src/data` e `src/v2/io` fanno `.from()` diretto (35 in `v2/ui`, il resto sparso): violano l'ownership dei dati.

## 5. Punti di accoppiamento piu' pericolosi

1. Cicli `components <-> v2` (53 file): bloccano qualsiasi estrazione di modulo.
2. `.from()` diretto in UI (35 casi in `v2/ui`): l'UI possiede query di altri moduli.
3. Doppio DAL (`src/data` legacy + `src/v2/io`) sulla stessa entita'.
4. Edge Functions cross-domain in catena sincrona (email -> CRM -> AI).
5. Rotte alias duplicate: rimuoverle a caldo rompe bookmark e UX.
6. Nodi critici da non toccare: submit outreach, invio email, sync IMAP, auth/RLS, dedup, memoria AI.

## 6. Primo batch candidato (piccolo, reversibile, zero rischio funzionale)

**Batch 1 - "Boundary map + morti certi"**
1. Aggiungere `docs/architecture/modules.md` con la mappa moduli (sola documentazione).
2. Introdurre un report non bloccante `scripts/audit-module-boundaries.mjs` che conta: import ciclici legacy<->v2, `.from()` fuori DAL, import cross-module. Baseline registrata, **warning only**.
3. Rimuovere solo i file della lista "sicuramente morto" (15 file), dopo doppia verifica di zero riferimenti (import statico, stringa dinamica, route lazy).
4. Nessuna modifica a comportamento, rotte, DB, Edge Functions.

**Batch 2 (proposto dopo verifica)**: spezzare i 53 import legacy->v2 spostando tipi e contratti condivisi in `src/v2/core/contracts` (solo move + re-export, nessuna logica).

## 7. Rollback strategy

- Ogni batch e' un insieme di modifiche coerente, ripristinabile dalla History (revert al messaggio precedente).
- Le cancellazioni vanno sempre in un batch separato dai refactor, mai insieme.
- Adapter/re-export temporanei quando si sposta un file, cosi' i caller esistenti continuano a funzionare.
- Nessuna migration DB in questa fase; nessun deploy.

## 8. Criteri oggettivi di "batch completato senza regressioni"

- Typecheck: 0 errori.
- Lint e ratchet (`any`, bundle) uguali o migliori del baseline.
- Suite test: almeno 3154 test verdi (nessuna regressione rispetto all'ultima esecuzione).
- Build produzione OK, bundle entro il ratchet corrente.
- Smoke E2E Playwright sulle rotte principali (command, dashboard, crm, inbox, outreach, agents): nessun errore console nuovo, nessun 4xx/5xx nuovo.
- Contatori boundary (cicli, `.from()` fuori DAL) monotoni non crescenti.
- Nessun diff in `supabase/migrations`, RLS, auth o contratti Edge.

## Nota tecnica

L'ipotesi "grande V1 residuo da cancellare" non e' confermata dai dati: il routing V1 e' gia' stato eliminato (1 sola pagina residua). Il debito reale e' **accoppiamento**, non duplicazione di pagine. Il piano privilegia quindi la creazione dei confini prima di ogni cancellazione.