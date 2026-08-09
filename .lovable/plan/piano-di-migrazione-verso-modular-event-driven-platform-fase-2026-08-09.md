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

---

# Addendum: suite di servizi + Cobra come orchestratore esterno

## A1. Stato attuale rilevato (read-only)

- **Cobra non esiste nel codice**: nessun file, funzione o riferimento "cobra" nel repo. Oggi e' solo un protocollo operativo di sviluppo in memoria progetto, non un motore. Va quindi **creato da zero come servizio esterno**, non estratto.
- **Lo scraper e' oggi interno e sparso** su almeno 3 livelli: Edge Functions (`scrape-website`, `enrich-partner-website`, `batch-enrichment-worker`, `process-inbound-enrichment`, `ai-deep-search-helper`), client (`src/lib/api/wcaScraper.ts`, `src/lib/acquisition/scanDirectory.ts`, `hooks/useDeepSearch*`, `useFireScrapeExtensionBridge`, `WCAScraper.tsx`) e tool Command (`scrapeCompanyWebsite`, `enrichPartnerFromWebsite`, `enrichProspectFromWebsite`). Nessun confine unico: e' il candidato numero uno all'estrazione.

## A2. Mappa target aggiornata (suite, non monolite)

```text
                         +-------------------+
                         |   COBRA (esterno) |  orchestratore: DAG, fan-out,
                         |  workflow engine  |  retry, attese, aggregazione
                         +---------+---------+
                                   | contratti/eventi (job API + webhook/outbox)
   +-----------+-----------+-------+-------+-----------+-----------+
   |           |           |               |           |           |
 Scraper    Research/    Funnemail      WCA Network   AI Platform  Agent
 (esterno)  Enrichment   (email svc)    (data src)    (capacita')  Framework
   |           |           |               |           |           |
   +-----------+-----------+-------+-------+-----------+-----------+
                                   |
                        +----------v-----------+
                        |  NAVIGATOR (hub)     |  UI/Command Center,
                        |  data hub + viste    |  CRM, Pipeline,
                        |  aggregate + Dash    |  Operational Dashboard
                        +----------------------+
```

Regola: lavoro semplice = chiamata diretta al servizio. Lavoro complesso = Navigator crea un **job** su Cobra; Cobra compone il DAG e riporta stato/risultati; Navigator li visualizza e li persiste.

## A3. Classificazione: estrarre come servizio vs riorganizzare come modulo interno

| Area | Destino | Motivazione |
|---|---|---|
| Scraper / crawling / fetch pagine | **Estrarre - servizio esterno** | I/O pesante, rate-limit, proxy, blocchi anti-bot, ciclo di rilascio proprio. Oggi sparso su edge + client + tool. |
| Deep Search 3 livelli / Research-Enrichment | **Estrarre - servizio esterno** (consumatore dello Scraper) | Lavoro batch lungo, retry, costo; deve essere consumabile da CRM, Sales, Agents, Command. |
| Funnemail (classificazione, routing, autoresponder) | **Estrarre - servizio email** | Dominio chiuso, gia' con tabelle proprie `funnemail_*`; espone API decisioni + eventi. |
| IMAP sync / invio email | **Estrarre insieme a Funnemail** (worker) | Long-running, stateful, sensibile: non deve vivere nell'app. |
| WCA Network / TMWE bridge | **Estrarre - fonte dati esterna** | E' gia' un sistema terzo; oggi accoppiato via `tmwe_*` e bridge token. |
| Orchestrazione workflow (missioni, campagne multi-step, autopilot) | **Estrarre in Cobra** | E' esattamente il ruolo dell'orchestratore: DAG, fan-out, attese, aggregazione. |
| Agent Framework (missioni/task/planning/execution) | **Modulo interno ora, estraibile poi** | Deve prima appoggiarsi a Cobra per l'esecuzione; l'intelligenza di planning puo' restare in Navigator. |
| AI Platform (modelli, prompt, KB, memory, tooling) | **Modulo interno con API pubblica** | Capacita' condivisa; estrazione solo se serve scalare o isolare i costi. |
| CRM (contatti, partner, dedup, soft-delete) | **Modulo interno estraibile** | E' il cuore del data hub; confine forte ma estrazione non prioritaria. |
| Sales Intelligence, Pipeline, Deals | **Modulo interno** | Vive sui dati CRM, poco I/O esterno. |
| Marketing Automation (outreach, cadenze, A/B) | **Modulo interno + worker Cobra** | Decisioni in Navigator, esecuzione temporizzata a Cobra. |
| Operational Dashboard / osservabilita' | **Modulo interno, ma aggregatore multi-servizio** | Deve leggere lo stato dei job Cobra e la salute di ogni servizio. |
| Core Platform (auth, layout, design system, contratti) | **Resta in Navigator** | Nessuna estrazione. |

## A4. Contratti minimi da definire prima di qualsiasi estrazione (solo documento)

1. **Job API** (Cobra): `POST /jobs {type, payload, idempotency_key}` -> `job_id`; `GET /jobs/{id}`; callback/webhook al completamento.
2. **Event envelope** comune: `{event_id, type, occurred_at, source, subject_id, payload, version}`.
3. **Outbox** lato Navigator: gli eventi si scrivono in tabella e un worker li pubblica (nessuna chiamata cross-service dentro una transazione UI).
4. **Idempotenza obbligatoria** su ogni consumer (dedup, invio email, enrichment) per evitare doppi side-effect.
5. **Service contract card** per ogni servizio: dati posseduti, API pubblica, eventi emessi/consumati, SLO, owner.

## A5. Impatto sui batch

Il Batch 1 resta invariato (documentazione + audit non bloccante + 15 file morti). Si aggiunge al Batch 1 solo documentazione:

- `docs/architecture/service-suite.md`: mappa suite + ruolo di Cobra + tabella di classificazione qui sopra.
- `docs/architecture/contracts/README.md`: bozza di Job API ed Event envelope (nessuna implementazione).

Batch successivi proposti, nell'ordine (ognuno da approvare a parte):

- **Batch 3 - Scraper facade**: introdurre un unico punto di accesso interno allo scraping (`src/v2/io/scraping/`) che oggi inoltra alle Edge Functions esistenti. Nessun cambio di comportamento, ma da quel momento esiste un solo confine da puntare al futuro servizio esterno.
- **Batch 4 - Research facade**: stessa cosa per deep search/enrichment, sopra la facade scraper.
- **Batch 5 - Job/Outbox contract (dietro feature flag, spento)**: tabella job + envelope evento, nessun consumer attivo.
- **Batch 6 - Cobra PoC esterno**: primo workflow non critico (es. enrichment batch) instradato via Cobra, con fallback immediato al percorso attuale.

Criteri di completamento e rollback restano quelli delle sezioni 7 e 8.