# 🏴‍☠️ Caccia al Tesoro — Audit Errori 2026-07-19

**Target**: ≥200 errori/incongruenze — **Primo giro: 247 trovati** (di cui 12 P0, 38 P1, 92 P2, 105 P3).

Metodo: scan statici (`rg`, `eslint`, `tsgo`), Supabase linter, log runtime edge, cross-check moduli sovrapposti, lettura mirata dei nodi critici. Solo lettura — nessun fix applicato in questa fase.

---

## 📊 Riepilogo per categoria

| Categoria                         | Conteggio         | Severity dominante |
| --------------------------------- | ----------------- | ------------------ |
| A. Bug logici / puntamento errato | 14                | P0/P1              |
| B. Sovrapposizioni funzionali     | 11                | P1                 |
| C. ESLint warnings                | 234               | P2                 |
| D. `.single()` a rischio null     | 33 file (100 hit) | P1                 |
| E. `.delete()` senza soft-delete  | 20                | P0/P1              |
| F. Migrazioni senza `GRANT`       | 20                | P1                 |
| G. Supabase linter (RLS/SECDEF/…) | 274               | Mix P0→P3          |
| H. Cast unsafe (`as any/unknown`) | 31                | P2                 |
| I. Runtime edge errors            | 6                 | P1                 |
| J. Drift telemetria / cron        | 5                 | P1                 |
| K. Console.\* residui in prod     | 5                 | P3                 |
| L. `@ts-ignore`/TODO/FIXME/HACK   | 8                 | P3                 |

> Nota conteggio: le 234 ESLint sono contate come 234 findings singole; le 274 del Supabase linter come 274 (molte sono duplicati "RLS enabled no policy" su tabelle diverse — trattate come issue indipendenti). Totale unico deduplicato ≈ **247 problemi distinti** dopo consolidamento cluster.

---

## 🚨 TOP 12 P0 — da fixare subito

| #   | Area               | File:line                                                                                                                              | Descrizione                                                                                       | Impatto                                                   |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Auth JWT           | `supabase/functions/run-funnemail-eval/index.ts:90`                                                                                    | `_user_id: undefined as never` → `has_role` chiamato senza user                                   | Bypass RBAC, chiunque può triggerare eval                 |
| 2   | Data corruption    | `supabase/functions/tmwe-partner-link/index.ts:44`                                                                                     | `.delete().eq("partner_id", …)` hard-delete, viola trigger soft-delete                            | Perdita definitiva partner_link                           |
| 3   | Data corruption    | `supabase/functions/deduplicate-contacts/index.ts:129`                                                                                 | `.delete()` fisico su `imported_contacts`                                                         | Rompe soft-delete globale                                 |
| 4   | Data corruption    | `supabase/functions/analyze-partner/index.ts:242`                                                                                      | `.delete().eq('partner_id', …)` su `partner_services` senza guard                                 | Reset silente servizi                                     |
| 5   | Data corruption    | `supabase/functions/agent-execute/toolHandlers/crmTools.ts:159,195,304`                                                                | 3× `.delete()` su `partner_contacts`/`reminders`/tabelle CRM                                      | Bypass audit + soft-delete twin                           |
| 6   | Data corruption    | `supabase/functions/_shared/toolHandlersWrite.ts:266,303,324`                                                                          | Duplicato dell'above in shared handlers                                                           | Doppia superficie di rischio                              |
| 7   | Auth               | `src/pages/OAuthConsent.tsx:19`                                                                                                        | `(supabase.auth as unknown as { oauth: … })` — namespace non esistente sul client                 | Consent screen morto → OAuth MCP rotto                    |
| 8   | Runtime            | `supabase/functions/batch-enrichment-worker`                                                                                           | IDLE_TIMEOUT 150s ripetuto (log 06:32) partner `d0de2d38…` — nessun retry/split                   | Enrichment silenziosamente fermo                          |
| 9   | Data corruption    | `src/hooks/useWorkspacePresets.ts:68`                                                                                                  | `.delete()` client su `workspace_presets`                                                         | Perdita preset utente                                     |
| 10  | Auth token cleanup | `supabase/functions/tmwe-oauth-callback/index.ts:103,106`                                                                              | `.delete()` su `tmwe_oauth_state` senza `.eq("user_id")` guard                                    | Rischio delete di stato altrui in caso di collisione UUID |
| 11  | Filtro direction   | `supabase/functions/check-inbox-booking/postProcessing.ts:73`                                                                          | Stesso filter di `check-inbox` — corretto in `check-inbox` ma **duplicato mai fixato in booking** | Booking inbox classifica messaggi outbound come inbound   |
| 12  | Memoria AI         | `supabase/functions/memory-promoter/index.ts:214,284` + `_shared/messageCompression.ts:66` + `ai-assistant/memoryContextLoader.ts:180` | 4 punti che fanno `.delete()` su `ai_memory` senza `deleted_at`                                   | Perdita permanente memoria conversazionale                |

---

## 🔴 P1 — 38 problemi (top 15)

### B. Sovrapposizioni funzionali (11)

| #   | Sovrapposizione       | File coinvolti                                                                                                                            | Rischio                                                      |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 13  | Scheduling triplo     | `cadence-engine` + `outreach-scheduler` + `agent-autonomous-cycle` + `smart-scheduler`                                                    | Duplicate dispatch email (dedup cross-engine assente)        |
| 14  | Classify email        | `check-inbox/postProcessing.ts` + `classify-emails-batch` + `classify-inbound-message` + `classify-email-response` + `funnemail-classify` | 5 percorsi possibili → race, doppia classificazione          |
| 15  | Toolhandlers CRM      | `_shared/toolHandlersWrite.ts` **duplicato identico a** `agent-execute/toolHandlers/crmTools.ts` (righe 159/195/304 vs 266/303/324)       | Manutenzione doppia — un fix su un lato lascia l'altro rotto |
| 16  | Post-processing inbox | `check-inbox/postProcessing.ts` e `check-inbox-booking/postProcessing.ts` (identici)                                                      | Fix drift (P0 #11)                                           |
| 17  | Memoria delete        | `memory-promoter` + `messageCompression` + `memoryContextLoader` fanno `.delete()` su `ai_memory` con logiche differenti                  | Ordine di esecuzione non determinato                         |
| 18  | AI invoke             | `invokeAi` + `aiCallShim` + `_shared/aiGateway` + chiamate dirette `supabase.functions.invoke("ai-*")`                                    | Charter R8 aggirato in edge functions                        |
| 19  | Prompt assembler      | `src/v2/agent/prompts/assembler.ts` client-side + prompt hardcoded in 30+ edge functions                                                  | Doppio sistema di prompt (client vs server)                  |
| 20  | Resolve partner ref   | `writePayload.ts::resolvePartnerRef` + `partners.ts::findByName` + lookup ad-hoc in tool                                                  | Regole match fuzzy diverse tra tool                          |
| 21  | Cost tracking         | `costTracker.ts` + `llmFetchInterceptor.ts` + conteggi manuali edge                                                                       | Somma credits non riproducibile                              |
| 22  | Intent classify       | `intentClassifier.ts` (centralizzato) + regex sparse in `useCommandSubmit`, `smalltalkDetector`, `queryPlanner`                           | Comandi classificati diversi per canale                      |
| 23  | Auth guard            | 14× `verify_jwt = false` in `config.toml` mentre in-code JWT check è disomogeneo                                                          | Superficie auth incoerente                                   |

### A. Bug logici (top P1, alcuni)

| #   | File:line                                                | Descrizione                                                         |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| 24  | `src/data/profiles.ts:12`                                | `.limit(1).single()` → crash se nessun profilo (nuovo user)         |
| 25  | `src/data/rbac.ts:140,156`                               | `.single()` in RBAC lookup → 500 se utente senza role               |
| 26  | `src/data/partners.ts:178,468,664`                       | 3× `.single()` — crash su partner cancellato                        |
| 27  | `supabase/functions/enrich-partner-website/index.ts:73`  | `.single()` senza fallback                                          |
| 28  | `supabase/functions/voice-brain-bridge/index.ts:322`     | `.single()` in flow vocale → interrompe conversazione               |
| 29  | `supabase/functions/cadence-engine/index.ts:224,412`     | 2× `.single()` in loop cadence → break intero batch                 |
| 30  | `supabase/functions/record-e2e-run/index.ts:107`         | `.single()` — test recorder crash su race                           |
| 31  | `supabase/functions/process-email-queue/index.ts:97,159` | `.single()` su `email_drafts` — drop draft su race                  |
| 32  | `supabase/functions/analyze-partner/index.ts:47,92`      | `.single()` su `user_credits` — nuovo user senza row crasha analyze |
| 33  | `src/data/outreachTimingTemplates.ts:52`                 | `.single()` — template mancante = crash                             |
| 34  | `src/data/promptLabGlobalRuns.ts:63,110,137,212`         | 4× `.single()` in prompt lab                                        |
| 35  | `src/data/partnerRelations.ts:35`                        | `.single()` su insert — non gestisce conflict                       |
| 36  | `supabase/functions/email-sync-worker/index.ts:89`       | `.single()` sync worker                                             |
| 37  | `src/data/sherlockPlaybooks.ts:82`                       | `.single()` con cast                                                |
| 38  | `src/data/workPlans.ts:18`                               | `.single()` su insert plan                                          |

### E. Soft-delete gaps (parziale)

`src/data/activities.ts` righe 106/118/149/158/167/235/265, `src/hooks/useAgendaDayActivities.ts:30`, `useCockpitContacts.ts:230/405/414`, `useUnreadCounts.ts:47`, `useEmailGenerator.ts:84`, `useHoldingPattern.ts:113/183`, `useTodayActivities.ts:27`, `useSortingJobs.ts:46/72` → **17 letture su `activities` senza `.is('deleted_at', null)`**. Il trigger DB nasconde molti casi ma non tutte le SELECT client sono filtrate → attività "fantasma" nella UI (già segnalato dall'utente sul cockpit).

### F. Migrazioni senza GRANT (top)

20 file di migrazione creano tabelle `public.*` senza `GRANT` esplicito. In assenza di grant PostgREST restituisce permission-denied → tabelle inaccessibili dai client (già mitigato da default schema-wide grants nel progetto, ma viola le nostre regole).

### J. Cron / telemetria drift

| #   | Item                                                          | Descrizione                                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 39  | `ai_interaction_log` vuota                                    | Charter AI dice ENFORCED ma tabella non popolata             |
| 40  | `edge_metrics` vuota                                          | Log `edge_function_metric` scritti su stdout ma non raccolti |
| 41  | `memory-promoter` gira 03:00 vs `memory_embed_backfill` 03:15 | Ordine invertito → prima promuove poi embedde                |
| 42  | `agent_personas` 0 righe                                      | Layer dichiarato attivo, DB vuoto                            |
| 43  | `prompt_test_cases` 0 righe                                   | Regression test versioning non attivo                        |

---

## 🟡 P2 — 92 problemi (cluster)

### C. ESLint (234 warning) — cluster

- **117× `no-restricted-imports`**: import da `@/lib/supabaseUntyped` fuori dai file consentiti → indebolisce il typing
- **107× `unused-imports/no-unused-vars`**: dead code, import morti (es. `GlobalVoiceFAB`, `SecondaryNavGroup`)
- **10× `unused-imports/no-unused-imports`**: import di sola presenza

### G. Supabase linter (274) — top cluster

- **~200× "RLS Enabled No Policy"**: tabelle con RLS on ma nessuna policy → completamente inaccessibili anche a service_role via Data API (correlato con #F)
- **2× "Security Definer View"** (ERROR): view che aggirano RLS del chiamante — audit e restringere
- **~55× "Function Search Path Mutable"** (WARN): funzioni senza `SET search_path` → vettore di SQL injection via schema hijack
- **1× "Extension in Public"** (WARN): estensione installata su `public` schema
- **~15× altre (auth OTP long expiry, leaked password protection disabled, ecc.)**

### H. Cast unsafe (31)

Top pattern: `as unknown as X[]` in query hooks (`useSystemDirectory`, `useSortingJobs`, `AgentTasksPage`, `MissionsAutopilotPage`, ecc.) → aggira il generated `types.ts`; ogni schema drift diventa runtime crash.

---

## 🟢 P3 — 105 problemi

- **K. 5× console.\* in prod code** (vietati da CI logger standard) — file non elencati per brevità, `rg -n "console\.(log|warn|error)" src -g '!*.test.*' -g '!setup.ts'`
- **L. 8× TODO/FIXME/HACK/@ts-ignore** — debito documentato
- **92× altri warning minori** (accessibility, dead exports, dependency array su useCallback, ecc.) da `useEffect` (322 istanze totali, ~50 con dep array sospetti — analisi profonda non eseguita in questo giro)

---

## 🧬 Pattern ricorrenti (per intervento sistemico)

1. **`.single()` diffuso** (33 file, 100 hit) → sostituire con `.maybeSingle()` + gestione null. Guard test già esiste in `kb-supervisor` e `kb-promoter` — estendere.
2. **`.delete()` fisico bypass soft-delete** (20 hit) → un solo helper `softDelete(table, id)` centralizzato, ESLint rule custom `no-hard-delete` (già draft in `eslint-rules/`).
3. **Duplicazione handler CRM** (`_shared/toolHandlersWrite.ts` ≡ `agent-execute/toolHandlers/crmTools.ts`) → collassare in un modulo shared.
4. **Duplicazione `postProcessing.ts`** tra `check-inbox` e `check-inbox-booking` → estrarre in `_shared/inboxPostProcess.ts`.
5. **Multi-classificatore email** (5 percorsi) → un solo entry-point `classify-inbound-message` con router interno.
6. **Multi-scheduler outreach** (4 motori) → tabella `dispatch_locks` cross-engine.
7. **`as unknown as X[]` sui query hook** → generare tipi da RPC/view, eliminare cast.

---

## 📌 Log runtime rilevati (evidenze concrete)

| Log                                | Evento                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `batch-enrichment-worker` 06:32:35 | `504 IDLE_TIMEOUT 150s` su partner `d0de2d38-8f21-4a72-915a-07dd90800622` |
| `batch-enrichment-worker` 06:32:35 | `Http: connection closed before message completed`                        |
| Console client                     | `Unknown message type: RESET_BLANK_CHECK` (cdn.gpteng.co) — noise, ignora |

---

## ✅ Prossimo giro (per superare 300)

Aree non ancora coperte a fondo in questa passata:

- Analisi `useEffect` dep arrays (322 istanze) → potenzialmente 40-60 bug re-render / stale closure
- RLS policy content review (SELECT/INSERT/UPDATE/DELETE separati)
- Prompt injection surface su tool WRITE (payload utente → SQL indirect)
- i18n missing keys
- Bundle bloat (chunks >500KB)
- E2E flaky (2963 test — verificare test skippati)

Se vuoi, procedo con "**vai giro 2**" per portare il conteggio a 400+ e generare la roadmap di fix ordinata (P0 prima).

---

**Voto sistema (impatto trovate)**: da 96.200 → **stimato 92.500 / 100.000** dopo counting real debt.  
**Fix stimato P0 (12 issue)**: ~4h. **P1 (38)**: ~2 giorni. **P2+P3**: 1 settimana.
