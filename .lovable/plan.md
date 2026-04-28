# Piano di Refactoring Riconciliato — Aprile 2026

> Il documento "WCA_REFACTORING_PLAN_last.docx" descrive lo stato del codice ad **Aprile 2026** prima di molti interventi già completati nei mesi successivi (cf. `mem://index.md`). Questo piano **non riparte da zero**: confronta il documento con lo stato attuale del codice e propone solo gli interventi **ancora aperti** o **parzialmente fatti**, mantenendo l'architettura esistente (Prompt Lab, DAL, V2, agent-execute, contentNormalizer, injectionGuard).

---

## Sezione A — Già completato (NON rifare)

Questi punti del documento sono già implementati in produzione. Non vanno toccati per non regredire.

| Doc | Tema | Implementazione attuale |
|---|---|---|
| C1 | ProtectedRoute bypass | `src/components/auth/ProtectedRoute.tsx` enforce JWT + redirect `/auth` |
| C2-C4 | Credenziali WCA in chiaro | Tabella `user_wca_credentials` per-utente |
| C5 | RLS `USING(true)` su `ra_*` | Tabelle `ra_*` rimosse dallo schema |
| D1 | `email_drafts` senza `user_id` | Colonna NOT NULL + indice + RLS |
| D4 | `types.ts` non sincronizzato | Tipi rigenerati automaticamente |
| E1 | Zero rate limiting | `_shared/rateLimiter.ts` |
| E5 | `_shared/` mancante | 117 file in `supabase/functions/_shared/` |
| A2 | Prompt hardcoded | Prompt Lab + tabella `operative_prompts` + `prompt_versions` (snapshot immutabili) |
| A3 | Response parsing fragile | `_shared/aiJsonValidator.ts` (Zod) |
| A4 | No cost tracking | `tokenLogger.ts` + `edge_metrics` + `structuredLogger.ts` |
| A5 | KB injection incoerente | `_shared/operativePromptsLoader.ts` unificato |
| A6 | Zero prompt-injection protection | `_shared/promptSanitizer.ts` + `_shared/injectionGuard.ts` + `prompt_injection_reviews` |
| M1 | No retry email | `retry_count` attivo in `process-email-queue` |
| M4 | `user_id` mancante in `email_campaign_queue` | Colonna presente |

---

## Sezione B — Ancora aperti (interventi proposti)

Ordinati per priorità, **senza riscritture architetturali**: ogni intervento è un patch chirurgico compatibile con la struttura esistente.

### Priorità 1 — Sicurezza residua (2-3 giorni)

| # | Doc | Intervento | File |
|---|---|---|---|
| P1.1 ✅ | C6 | CORS `*` rimossi (8 funzioni). Cf. `mem://security/cors-wildcard-cleanup-2026-04-28` |
| P1.2 ✅ | C7 | `save-wca-cookie` ora usa `requireExtensionAuth` (JWT preferito, anon-key gated da CORS). Limite payload 20KB |
| P1.3 ✅ | E2/E3 | `analyze-import-structure` + `elevenlabs-conversation-token` ora richiedono JWT valido (no anon-key, no soft-fail) |
| P1.4 ✅ | E6 | SSRF guard `assertSafePublicUrl()` in `_shared/inputValidator.ts` (14 test verdi). Applicata a `scrape-website` e `enrich-partner-website` |
| P1.5 ✅ | B4/B5 | Edge function LinkedIn hardenizzate: `linkedin-ai-extract` e `linkedin-profile-api` ora richiedono auth via `requireExtensionAuth` (proteggono crediti AI Gateway e Proxycurl). Cf. `mem://security/linkedin-bridge-hardening-2026-04-28` |

### Priorità 2 — Schema DB residuo (1 giorno)

| # | Doc | Intervento |
|---|---|---|
| P2.1 ✅ | D2 | Indici composti aggiunti: `partners(country_code,lead_status)`, `imported_contacts(user_id)`, `download_jobs(status,user_id)`, `activities(partner_id,status)`, `email_campaign_queue(status,scheduled_at)` |
| P2.2 ✅ | D3 | FK ON DELETE CASCADE verso `auth.users` aggiunte su `agent_tasks`, `ai_conversations`, `ai_memory`, `import_logs` |
| P2.3 ✅ | D5 | Zod validators in `src/data/schemas/jsonValidators.ts` per `partners.enrichment_data` (passthrough) e `agents.assigned_tools` (snake_case + cap 100). Safe + strict. 9/9 test verdi |

### Priorità 3 — Email Pipeline residuo (1-2 giorni)

| # | Doc | Intervento |
|---|---|---|
| P3.1 ✅ | M2 | Tabella `email_delivery_events` + trigger `apply_email_delivery_event` (auto-update `email_campaign_queue.status` su bounce/complaint/rejected/opened) + edge function `email-delivery-webhook` con shared-secret `EMAIL_WEBHOOK_SECRET`, validazione Zod, batch ≤500 |
| P3.2 ✅ | M3 | Già coperto da `runPostSendPipeline` (LOVABLE-85): activity inserita con `status=completed`, lead_status escalation, interaction logged, partner counters atomici. Nessun lavoro residuo |
| P3.3 ✅ | M5 | `_shared/smtpRateLimit.ts` (DB-based, no-op quando kill-switch off). Integrato in `process-email-queue`: se cap raggiunto, draft → `paused`, batch interrotto, riprende al prossimo invocation. Cap configurabile via `app_settings.smtp_rate_limit_per_hour` (default 50). 3/3 test verdi |

### Priorità 4 — Bridge & Hooks consolidation (2-3 giorni)

| # | Doc | Intervento |
|---|---|---|
| P4.1 ✅ | B1 | Verificato: solo `wcaAppApi.ts` esiste in repo (nessun `wcaAppBridge.ts` o `wca-app-bridge.ts`). Già SSOT |
| P4.2 ✅ | B2 | `wcaAppApi.getOrRefreshCookie` ora usa `wcaCookieStore` come SSOT (no duplicazione localStorage). `setWcaCookie`/`getWcaCookie` unico punto di accesso |
| P4.3 ✅ | B3 | `gateAndMark()` integrato in `wcaDiscover`, `wcaScrape`, `wcaEnrich`, `wcaVerify`. Background workers (job-start/status/worker) esclusi (rate limit lato server). `resetCheckpoint()` esportato per test |
| P4.4 ✅ | B6 | `wcaCookieStore`: `EFFECTIVE_TTL_MS = TTL_MS - 60s`. Refresh proattivo prima dello scadere. Test verdi |

### Priorità 5 — CRM Lifecycle (2 giorni)

| # | Doc | Intervento |
|---|---|---|
| P5.1 ✅ | CRM1 | RPC `find_import_duplicates(user_id, emails[], company_names[])` + integrazione in `useImportWizard.handleConfirmMapping` (warn non-bloccante via toast). Match: email in imported_contacts (utente) + email/company in partners (globale) |
| P5.2 ✅ | CRM2 | Colonne `imported_contacts.transferred_to_partner_id` + `transferred_at`. DAL `linkContactToPartner()` sostituisce `markContactTransferred` in `useTransferToPartners` e `useCreateActivitiesFromImport`. NO delete fisica |
| P5.3 ✅ | CRM4 | Funzione `expire_stuck_import_logs()` + cron `*/15 * * * *` (jobid=49) → marca `pending|processing` > 30min come `expired`. Cf. `mem://features/p5-crm-lifecycle-2026-04-28` |

### Priorità 6 — TS strict + Testing (incrementale, in background)

| # | Doc | Intervento |
|---|---|---|
| P6.1 | I1 | Abilitare `strictNullChecks` in `tsconfig.app.json` come prima fase. NO full `strict: true` finché non si pulisce il debt budget |
| P6.2 | I4 | Test E2E minimi: auth flow, email queue, AI response parsing (riusare `vitest.config.ts` esistente) |
| P6.3 | I2 | Lazy-load Three.js solo in `/global` route (verificare se non già fatto via React.lazy) |

---

## Sezione C — Esplicitamente NON da fare

Punti del documento che **contrastano con l'architettura attuale** o sono stati superati da scelte successive:

- **A1 — "Consolidare 9+ orchestratori in `ai-orchestrator` unico"**: contrario all'attuale separazione per scope (`agent-execute`, `ai-assistant`, `generate-email`, `generate-outreach`, `classify-*`). Ogni orchestratore ha responsabilità distinte e contratti diversi. La **convergenza è già avvenuta a livello di componenti condivisi** (`_shared/operativePromptsLoader`, `aiGateway`, `promptSanitizer`, `aiJsonValidator`, `contentNormalizer`, `injectionGuard`).
- **E2 — "Eliminare SERVICE_ROLE_KEY in tutte le 37 funzioni"**: molte funzioni sono background workers (cron, trigger DB) che NON hanno JWT utente disponibile. Mantenere SERVICE_ROLE dove documentato; usare JWT solo in funzioni invocate dall'utente.
- **E4 — "Eliminare 14 funzioni orfane"**: violerebbe `mem://project/development-status-governance` (codice unused può essere in development). Tagging deprecation invece di delete.
- **CRM2/CRM3 con DELETE fisico**: sostituiti da soft-link/soft-delete (`mem://constraints/no-physical-delete`).
- **I3 — "Migrazione fuori da Lovable cloud-auth"**: vendor lock-in accettato; documentare escape path è sufficiente.

---

## Effort totale stimato

| Priorità | Effort | Impatto |
|---|---:|---|
| P1 Sicurezza residua | ~12h | HIGH |
| P2 Schema residuo | ~6h | MEDIUM |
| P3 Email pipeline | ~10h | HIGH |
| P4 Bridge/Hooks | ~14h | MEDIUM |
| P5 CRM lifecycle | ~10h | MEDIUM |
| P6 TS strict + test | continuous | MEDIUM |
| **Totale** | **~52h** | (vs 192h del piano originale) |

Il 73% del piano originale è già stato eseguito. Restano ~52h di patch chirurgici, eseguibili **una priorità alla volta** con deploy indipendente.

---

## Modalità di esecuzione consigliata

1. Fai un'unica prio per messaggio (es. "esegui P1.1") così ogni intervento è atomico, testabile e rollback-able.
2. Ogni step include: migrazione (se serve) → modifica codice → test verde → memoria aggiornata.
3. NON toccare `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (`mem://constraints/email-download-integrity`).
4. Tutti i nuovi prompt passano da Prompt Lab; tutti gli input non-trusted da `contentNormalizer` + `promptSanitizer` + `injectionGuard`.

Approvi il piano così com'è, o vuoi che modifichi priorità / aggiunga / rimuova qualche punto?