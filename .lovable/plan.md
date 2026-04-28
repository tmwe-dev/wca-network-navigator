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
| P1.5 | B4/B5 | LinkedIn bridge: validare `event.origin` con extension ID whitelist, gate `sendMessage` dietro conferma utente (riusare `prompt_injection_reviews` o `approvalFlow`) | `src/hooks/useLinkedInExtensionBridge.ts` |

### Priorità 2 — Schema DB residuo (1 giorno)

| # | Doc | Intervento |
|---|---|---|
| P2.1 | D2 | Audit indici mancanti su colonne `WHERE`/`JOIN` ad alto traffico (`partners(country_code,lead_status)`, `imported_contacts(email,user_id)`, `download_jobs(status,user_id)`, `activities(partner_id,status)`, `email_campaign_queue(status,scheduled_at)`). Migrazione `CREATE INDEX IF NOT EXISTS` |
| P2.2 | D3 | Aggiungere FK enforced verso `auth.users` su `agent_tasks`, `ai_conversations`, `ai_memory`, `import_logs` (ON DELETE CASCADE) |
| P2.3 | D5 | Validazione applicativa con Zod per JSON columns critiche (`partners.enrichment_data`, `agents.assigned_tools`) — solo nella DAL, no CHECK constraint |

### Priorità 3 — Email Pipeline residuo (1-2 giorni)

| # | Doc | Intervento |
|---|---|---|
| P3.1 | M2 | Tabella `email_delivery_events` + edge function webhook handler (parser bounce/delivery SMTP). Trigger di update su `email_campaign_queue.status` |
| P3.2 | M3 | Hook post-send in `process-email-queue`: dopo `sent`, `UPDATE activities SET status='sent' WHERE source_type/source_id` (estendere `logEmailSideEffects` esistente) |
| P3.3 | M5 | Rate limit SMTP per utente: integrare `_shared/rateLimiter.ts` in `process-email-queue` con cap configurabile da `app_settings` (default 50/h). **Compatibile con kill-switch `AI_USAGE_LIMITS_ENABLED`** |

### Priorità 4 — Bridge & Hooks consolidation (2-3 giorni)

| # | Doc | Intervento |
|---|---|---|
| P4.1 | B1 | Verificare se i 3 file bridge (`wcaAppBridge.ts`, `wca-app-bridge.ts`, `wcaAppApi.ts`) coesistono ancora. Se sì, mantenere SOLO `wcaAppApi.ts` e ridirezionare gli import. **NO delete fisica** dei file ancora in sviluppo (Code Lifecycle Governance) — usare deprecation notice |
| P4.2 | B2 | `WcaSessionContext` come SSOT — già parzialmente in `useWcaSession.ts`. Centralizzare lettura `localStorage`+extension state |
| P4.3 | B3 | Collegare `wcaCheckpoint.waitForGreenLight()` ai chiamanti `wca-app` API (download, enrich) |
| P4.4 | B6 | Pre-check cookie TTL in `useWcaAppDownload` e auto-refresh se < 1 min |

### Priorità 5 — CRM Lifecycle (2 giorni)

| # | Doc | Intervento |
|---|---|---|
| P5.1 | CRM1 | Deduplicazione all'import: check `imported_contacts.email` (lower) + `company_name` fuzzy in `useImportWizard`. Merge mode opzionale |
| P5.2 | CRM2 | Post-transfer in `useTransferToPartners`: marcare `imported_contacts.transferred_to_partner_id` (soft-link, NO delete fisica per `mem://constraints/no-physical-delete`) |
| P5.3 | CRM4 | Cron pg_cron per `import_logs` stuck > 30min → status `expired` |

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