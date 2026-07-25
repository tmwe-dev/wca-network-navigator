# Batch D4 — DAL bypass, cluster READ-only (AgentRolesOverviewPage)

Base: `38150b47`. Nessun deploy, nessuna migration, nessuno schema/policy modificato.

## Fase A — classificazione baseline

Formula riproducibile (stesso script D1/D2/D3):
```
grep -rEn --include=*.ts --include=*.tsx \
  -e 'supabase\.from\(' -e 'untypedFrom\(' -e 'tFrom\(' -e 'supabase\.rpc\(' src \
  | grep -v -E '^src/(data|integrations/supabase|lib/(supabaseUntyped|typedSupabase))' \
  | grep -v -E '\.test\.(ts|tsx)|^src/test/|^src/__tests__/'
```

Ogni linea contiene al più una call-expression: linee = call-site.

KPI (nuovi, non retroattivi):
- **KPI storico** — output dello script sopra. Include `src/v2/io/**`. Pre-D4: **278**.
- **KPI true UI/service bypass** — KPI storico meno `src/v2/io/**`. Motivazione: `src/v2/io/{supabase/queries,supabase/mutations,edge,external}` è un boundary IO parallelo alla DAL `src/data/`, documentato dalla struttura, importato da hook/pagine, mai da `src/components/`. Pre-D4: **236**.

ESLint non modificato in questo batch (allow-list attuale: `src/data/**`, `src/integrations/**`, `src/test/**`). Governance del boundary `src/v2/io` rimandata a batch dedicato.

Distribuzione per layer (baseline 278):

| Layer | Linee |
|---|---:|
| `src/v2/ui/**` | 93 |
| `src/components/**` | 75 |
| `src/v2/io/**` (boundary IO — escluso da KPI true) | 42 |
| `src/hooks/**` | 34 |
| `src/v2/hooks/**` | 19 |
| `src/v2/services/**` | 8 |
| `src/lib/**` | 3 |
| `src/v2/observability/**` | 2 |
| `src/v2/agent/**` | 2 |

## Fase B — cluster scelto

`src/v2/ui/pages/AgentRolesOverviewPage.tsx` (pagina "Chi fa cosa"): 5 query `supabase.from(...)` in un solo `Promise.all`, tutte READ-only, dichiarate nell'header del file come "Vista SOLA LETTURA, nessuna scrittura, nessun side-effect". Il metric script rileva 4 linee (una call è spezzata su più righe); post-migrazione entrambi i KPI scendono di 4.

Tabelle: `agents`, `agent_personas`, `agent_capabilities`, `funnemail_autoresponder_templates`, `wake_up_rules`.

DB (read-only): tutte 5 esistenti in `public`, RLS ON, policies count 5 / 4 / 4 / 2 / 4.

File modificati (4, inclusi test e plan):
- `src/data/agentRolesOverview.ts` — DAL specifico tipizzato `fetchAgentRolesOverview()`.
- `src/v2/ui/pages/AgentRolesOverviewPage.tsx` — sostituito `import { supabase }` con `import { fetchAgentRolesOverview }`; corpo `queryFn` invariato (stesso Set/Map/filter/map).
- `src/data/__tests__/agentRolesOverview.test.ts` — 3 test: chain builder esatta (select/is/eq/order) + mapping + equivalenza silenziosa (data null anche con error → []) + guardrail no-reintroduction.
- `.lovable/plan.md` — questa sezione.

Equivalenza preservata: stesse 5 tabelle, stesso ordine, stesso `select(...)` stringa, stessi `.is("deleted_at", null)` / `.eq("is_active", true)` / `.order("role", { ascending: true })`, stessa normalizzazione `data ?? []`. Il consumer non ispezionava `.error` prima e non lo ispeziona ora; nessun throw/retry/log introdotto. `queryKey ["agents", "roles-overview"]` e opzioni React Query invariati.

## Metriche

| Metrica | Pre-D4 | Post-D4 | Delta |
|---|---:|---:|---:|
| KPI storico | 278 | 274 | −4 (−1,44%) |
| KPI true UI/service bypass | 236 | 232 | −4 (−1,69%) |

Cumulativo D1+D2+D3+D4 su KPI storico: −20.

## Prove

- Vitest mirato `agentRolesOverview.test.ts`: 3/3 ✅.
- Typecheck `tsgo --noEmit`: ✅.
- ESLint sui 3 file toccati: ✅ (0 errori / 0 warning).
- Vitest suite completa Run A: **383 file, 3055 pass / 2 skip / 0 fail** (252,93 s).
- Vitest suite completa Run B: **383 file, 3055 pass / 2 skip / 0 fail** (226,20 s). Nessun nuovo skip vs pre-D4.
- Build produzione `bun run build`: ✅.

## Rischio & Rollback

Rischio: **nullo**. Pagina resta 100% read-only, stessi contratti sul network, stesso payload restituito a React Query. Nessun cambio RLS/policy/schema. Consumer unico.

Rollback: `git revert` del batch.

## Verdetto

**GO PIENO**. Fermo prima di D5.

---

# Audit Tecnico Read-Only — commit `fcbf8b4`

Ambito: intero repository. Nessuna modifica applicata. Numeri "verificati" = calcolati con comandi shell in questo turno; "inferito" = derivato da `<supabase-tables>` in contesto o da memoria di progetto.

---

## 1. Baseline quantitativa (verificata)

| Metrica | Valore | Comando |
|---|---:|---|
| File `src/**` (.ts/.tsx) | **2.364** | `find src -type f` |
| LOC totale `src/**` | **317.118** | `wc -l` |
| LOC `src/pages+components+hooks+contexts` (v1 residuo) | **136.635** | wc |
| LOC `src/v2/**` | **103.369** | wc |
| LOC edge functions | **86.230** | wc |
| Edge Functions | **150** | `ls supabase/functions` |
| Migrations | **416** | ls |
| Test unit (`src/**/*.test.*`) | **379** file / **3043** test verdi (dato pregresso) | find |
| Spec E2E | **80** | find |
| File > 500 LOC in `src/` | **28** (di cui 1 > 800 = `types.ts` autogen 13.979) | wc/awk |
| ESLint suppressions residue | **86** | grep |
| Occorrenze `: any` | **263** | grep |
| DAL bypass (`supabase.from` fuori da `src/data/`) | **193** | grep |
| Console.* in `src/` | **18** (basso) | grep |
| TODO/FIXME/HACK | **21** | grep |
| Tabelle in schema `public` | **~200** | `<supabase-tables>` (inferito) |
| Righe con "policies > 0" | maggioranza; alcune tabelle con **0 policies** (es. `oauth_state`, `tmwe_oauth_state`, `tmwe_system_tokens`, `tmwe_user_tokens`, `ai_extract_cache`, `permissions*`) | contesto tabelle |
| Feature flag runtime referenziati | **8** | grep |
| Prompt/registry files in `_shared/` | **152** file shared | ls |

Cassaforte "già verde" in questo ciclo (dato pregresso, non ri-eseguito ora): typecheck ✅, lint 0 errori (233 warning), build ✅, vitest 3043/3045.

Limiti onesti: **E2E autenticato non eseguito** in questo audit; nessun collaudo con utente reale in produzione; nessuna verifica di dati runtime (RLS effettivamente attive per riga, contenuti tabelle).

---

## 2. Voti per area (0-100)

Formato compresso: **Voto — Evidenza — Punti forti — Problemi — Rischio — Azione prioritaria**.

### A. Architettura & modularità — **74**
Ev: convivenza `src/` (v1, 136k LOC) e `src/v2/` (103k LOC); layering enforced via ESLint (`no-direct-ai-invoke`, `no-direct-bulk-op`, DAL rule); 150 edge functions.
Forti: DAL centralizzato, query keys centralizzati, strangler in corso (B0-B6 completati per messaging).
Problemi: doppio universo v1/v2 ancora vivo; 150 edge functions oltre soglia dichiarata "<100"; 193 bypass DAL residui.
Rischio: **alto** (superficie manutentiva).
Azione: chiudere migrazione v1→v2 per dominio (Contatti, Partner, Comms) e ridurre edge a <100 con consolidamento.

### B. Semplicità del codice — **70**
Ev: 28 file >500 LOC (escluso autogen), 263 `any`, 86 suppressions.
Forti: solo 1 file >800 LOC (autogen); console.* quasi azzerati.
Problemi: `any` ancora ~263; suppressions non azzerate; complessità cumulativa 317k LOC.
Rischio: **medio**.
Azione: ratchet trimestrale su `any` e suppressions con budget bloccante.

### C. Logica & coerenza flussi — **82**
Ev: pipeline messaggi consolidata su `classify-inbound-message` + `reply_classifications` + view `message_intelligence_v` (B0-B6); guardrail test attivi.
Forti: SSOT dimostrata su messaging; strangler reversibile.
Problemi: pipeline outreach/deep-search/agenti non ancora consolidate allo stesso livello.
Rischio: **medio**.
Azione: replicare pattern strangler su Outreach e Deep Search.

### D. UX & facilità d'uso — **62** (inferito)
Ev: memory `StandardPageFrame`, drawer overlay pattern, lean mode; ma nessun test utente reale in questo audit.
Forti: framework UI unificato, temi coerenti.
Problemi: 725 componenti + 823 file v2 → rischio incoerenza percepita; Command page storicamente instabile; nessun E2E autenticato eseguito ora.
Rischio: **alto** (percepito).
Azione: sessione di usability test guidata su 5 flussi core.

### E. Utilità operativa — **78** (inferito da doc)
Ev: copertura funzionale ampia (CRM, Outreach, Comms, KB, Agenti, Pipeline).
Forti: end-to-end business coperto.
Problemi: molte feature "presenti ma non collaudate in produzione".
Azione: definire i 10 job-to-be-done e validarli con metriche d'uso reali.

### F. AI & qualità intelligenza — **80**
Ev: BYOK OpenAI attivo, fallback Gemini presente, journalistReview obbligatorio, prompt versioning, injection guard HIGH-block, budget config.
Forti: governance AI matura.
Problemi: costo/qualità non misurati sistematicamente per scope; 8 feature flags dispersi.
Azione: dashboard AI cost/quality per scope + eval periodica su `prompt_test_cases`.

### G. Agenti & orchestrazione — **74**
Ev: `agents`, `agent_capabilities`, `agent_personas`, `agent_missions`, `agent_tasks`, `agent_routing_rules`, `mission_actions`, Prompt Lab + Audit tab.
Forti: DB-driven, hot-reload, audit UI.
Problemi: molte tabelle agent (10+) → complessità concettuale; missioni/task loop non hanno KPI oggettivi documentati.
Azione: heartbeat KPI per mission_success_rate e p95 latency.

### H. KB / RAG / memoria — **68**
Ev: `kb_entries`, `kb_entry_proposals`, `kb_audit_reports`, `finder_api_kb`, `ai_memory`, `conversation_summaries`, `scraper_agent_memory`, `agent_knowledge_links`.
Forti: KB editabile da DB, audit.
Problemi: 6+ store di memoria distinti → possibile drift e duplicazione; nessuna prova di embedding/RAG unificato in codice letto ora.
Azione: mappa consumer per ogni store memoria e piano unificazione.

### I. Automazioni & autoapprendimento — **70**
Ev: `ai_edit_patterns`, `response_patterns`, `ai_daily_plans`, `wake_up_rules`, cron drain loop email, autoresponder template.
Forti: pattern learning presente.
Problemi: efficacia non misurata (nessun metrica pubblicata); rischio side-effect senza gate.
Azione: KPI settimanali su hit-rate pattern e revoke rate autoresponder.

### J. Dati / DB / RLS — **78**
Ev: ~200 tabelle, la maggior parte con policies; soft-delete trigger globale su 15 tabelle business; `has_role()` SECURITY DEFINER; 416 migrations.
Forti: pattern RLS/roles corretti; soft-delete centralizzato.
Problemi: 416 migration senza baseline consolidata; alcune tabelle `tmwe_*` e `oauth_state` con 0 policies visibili (verificare intenzionalità).
Rischio: **medio-alto** su drift schema.
Azione: consolidare in una baseline `2026_08_01_baseline.sql` e verificare le tabelle a 0 policies.

### K. Sicurezza & privacy — **80**
Ev: hard guards AI, injection guard HIGH-block, CORS whitelist, `verify_jwt=true` default con allowlist auditata, DOMPurify integrato, storage policies documentate.
Forti: threat model esplicito; RLS diffuse.
Problemi: 193 DAL bypass allargano superficie; CSP con `unsafe-inline` (accettato); nessun secret-scan eseguito in questo audit.
Azione: chiudere DAL bypass e completare rotazione `OPENAI_API_KEY` in secret store validato.

### L. Resilienza & idempotenza — **72**
Ev: bulk runner con `bulk_jobs`+`bulk_job_events`, DLQ replay spec E2E, edge resilience protocol, fallback view→legacy con predicato dedicato.
Forti: pattern strangler reversibile, DLQ.
Problemi: idempotency-key non documentato sistematicamente su edge write.
Azione: catalogare edge write e imporre `X-Idempotency-Key`.

### M. Osservabilità — **75**
Ev: `pipeline_traces`, `ai_runtime_traces`, `edge_function_logs`, `edge_metrics`, `ai_interaction_log`, structured logger obbligatorio, remote sink env-gated.
Forti: logger centralizzato, metriche AI cost.
Problemi: nessun SLO pubblicato; alert_config presente ma copertura non verificata.
Azione: definire 5 SLO (login p95, command p95, send-email success, classify latency, error-rate).

### N. Prestazioni & scalabilità — **68** (inferito)
Ev: bundle guard e lighthouse in CI, ma nessuna misura runtime in questo audit; 317k LOC lato client rilevante; `types.ts` 13.979 righe importato ovunque.
Problemi: bundle plausibilmente grande; nessun code-splitting misurato.
Azione: bundle report post-build e code-splitting per macro-area.

### O. Testabilità & CI — **86**
Ev: 3043 test verdi, 379 file test, 80 spec E2E, threshold coverage 11/53/30/11.
Forti: numeri robusti, guardrail test per cleanup.
Problemi: soglia coverage statements 11% è simbolica; E2E autenticato non eseguito ora.
Azione: ratchet coverage +3 punti/sprint e E2E autenticato in CI nightly bloccante.

### P. Manutenibilità & documentazione — **72**
Ev: `docs/` ricco (governance, ADR, audit), memoria progetto strutturata, README auto-sync.
Problemi: doc distribuita in 3+ posti (docs/, mem/, .lovable/memory/); rischio deriva.
Azione: single index `docs/INDEX.md` con owner per sezione.

### Q. Predisposizione a nuove feature — **74**
Ev: DAL, query keys, bulk runner, invokeAi gateway, agent registry DB-driven.
Problemi: v1 residuo costringe doppio lavoro su ogni feature cross-domain.
Azione: finire strangler v1→v2.

---

## 3. Voto complessivo ponderato / 100.000

Pesi (somma=100) e formula: `score_totale = Σ(peso_i × voto_i) × 10` → range 0-100.000.

| Area | Peso | Voto | Contributo |
|---|---:|---:|---:|
| A Architettura | 10 | 74 | 740 |
| B Semplicità | 6 | 70 | 420 |
| C Coerenza flussi | 8 | 82 | 656 |
| D UX | 8 | 62 | 496 |
| E Utilità operativa | 8 | 78 | 624 |
| F AI qualità | 8 | 80 | 640 |
| G Agenti | 6 | 74 | 444 |
| H KB/RAG | 5 | 68 | 340 |
| I Automazioni | 4 | 70 | 280 |
| J DB/RLS | 8 | 78 | 624 |
| K Sicurezza | 8 | 80 | 640 |
| L Resilienza | 5 | 72 | 360 |
| M Osservabilità | 4 | 75 | 300 |
| N Prestazioni | 4 | 68 | 272 |
| O Test/CI | 4 | 86 | 344 |
| P Manutenibilità | 2 | 72 | 144 |
| Q Nuove feature | 2 | 74 | 148 |
| **Totale su 100** | 100 | — | **7.472** |
| **Punteggio ×10 su 100.000** | | | **74.720 / 100.000** |

Nota anti-inflazione: i 3043 test verdi hanno pesato **solo** in area O (peso 4). Correttezza tecnica (O+J+K = peso 20) è separata da semplicità architetturale (A+B = peso 16) e UX/utilità reale (D+E = peso 16). Il voto E2E-non-eseguito è penalizzato in D e O.

---

## 4. Top 10 rischi (ordinati)

1. **Doppio universo v1/v2** (136k+103k LOC) → costo manutentivo e bug di parità.
2. **150 edge functions** → superfice attacco e drift config; obiettivo dichiarato <100 non raggiunto.
3. **193 DAL bypass** residui → RLS meno prevedibile lato client.
4. **416 migrations** senza baseline → onboarding e recovery lenti.
5. **E2E autenticato non eseguito in questo audit** → feature "verdi in CI" non equivalgono a "funzionano in prod".
6. **UX non validata con utente reale**, specialmente Command e Prompt Lab.
7. **6+ store di memoria/KB** senza unificazione → rischio drift risposte agenti.
8. **`types.ts` autogen 13.979 righe** importato ovunque → impatto bundle.
9. **Threshold coverage 11%** simbolico rispetto ai 3043 test (falso senso di sicurezza sul non-coperto).
10. **Tabelle con 0 policies visibili** (`oauth_state`, `tmwe_*_tokens`, `permissions*`) → verificare che siano intenzionalmente locked o service-role only.

## 5. Top 10 interventi ad alto impatto

1. **Chiusura strangler v1→v2** per Contatti + Partner + Comms (target: -60k LOC in v1).
2. **Consolidamento edge functions** a <100 (merge per dominio; 40+ candidati ovvi).
3. **Azzeramento DAL bypass** con codemod → 193 → 0.
4. **Baseline SQL unica** + squash migrations storiche.
5. **E2E autenticato nightly bloccante** con 15 flussi core.
6. **Coverage ratchet reale**: 11% → 40% in 8 sprint.
7. **Unificazione KB/memoria** (mappa consumer → 1 SSOT + adapter).
8. **Dashboard AI cost/quality per scope** + eval settimanale su `prompt_test_cases`.
9. **Bundle audit** e code-splitting per macro-area, `types.ts` slim import.
10. **SLO + alerting** su 5 metriche critiche con `alert_config` cablato.

## 6. Distanza reale da 9/10 complessivo

Attuale **74.720/100.000 ≈ 7,47/10**. Per raggiungere **9/10 (90.000)** servono **+15.280** punti. Con i pesi attuali, gli spostamenti realistici:

- A 74→88 (+140) · B 70→85 (+90) · D 62→82 (+160) · N 68→82 (+56) · H 68→82 (+70) · O 86→92 (+24) · J 78→88 (+80) · K 80→88 (+64) · C 82→90 (+64) · G 74→85 (+66) · Q 74→85 (+22).
- Somma ≈ +**~1.036** su 100 → **+10.360** su 100k. Insufficiente da solo: serve **anche** far salire E (78→90 → +96 = +960) e F (80→90 → +80 = +800) → totale ≈ **+12.120**.
- Restanti ~3.000 punti dipendono da **validazione produzione reale** (D, E, N).

Conclusione: **9/10 è raggiungibile in ~2 trimestri** solo se si eseguono strangler + E2E autenticato + validazione utente reale.

## 7. Roadmap 3 orizzonti

**Sprint (2 sett)** — chiusura debiti caldi
- E2E autenticato nightly bloccante (top 5 flussi).
- Codemod DAL bypass: -50%.
- Baseline SQL + squash migrations.
- Bundle report post-build + slim `types.ts`.

**Trimestre (Q3)** — riduzione superficie
- Strangler v1→v2 Contatti + Partner (target -40k LOC v1).
- Edge functions: consolidamento a <110.
- Unificazione KB/memoria: mappa + 1 SSOT.
- Coverage ratchet 11 → 25.
- Dashboard AI cost/quality per scope.

**Semestre (H2)** — salto qualitativo
- v1 sotto 20k LOC (solo pagine legacy congelate).
- Edge <100 stabile.
- Coverage 40, E2E autenticato blocking daytime.
- SLO pubblicati, alerting cablato.
- Usability test formale su 5 flussi + iterazione UX.

---

Report chiuso. Nessuna modifica applicata. Se vuoi, posso approfondire una singola area con letture mirate (es. inventario delle 150 edge functions per candidati merge, o mappa dei 193 DAL bypass per dominio) sempre in read-only.

---

## PROGRAMMA 90K — Batch D1 · Riduzione bypass DAL (READ-only)

**Commit di partenza**: `ffb93a25bdd1a81cdbe916db75c9a4d149c72926`
**Ambito**: solo letture. Nessuna modifica RLS/UX/schema/comportamento. Nessun deploy.

### Metrica riproducibile
Comando (salvato in `/tmp/dal_metric.sh` per riproduzione locale):
```
grep -rEn --include='*.ts' --include='*.tsx' \
  -e 'supabase\.from\(' -e 'untypedFrom\(' -e 'tFrom\(' -e 'supabase\.rpc\(' src \
  | grep -v -E '^src/(data|integrations/supabase|lib/(supabaseUntyped|typedSupabase))' \
  | grep -v -E '\.test\.(ts|tsx)|^src/test/|^src/__tests__/'
```
Esclusioni: DAL canonico, client generato, adapter escape-hatch, test, generated types, edge functions server-side, migrations.

### Baseline (pre-D1)
- **Totale bypass**: **294** call-site
  - `supabase.from`: 187
  - `untypedFrom`: 74
  - `tFrom`: 11
  - `supabase.rpc`: 10
- Top-3 file per densità: `dashboard.ts` (20), `RulesAndActionsTab.tsx` (14), `useRAProspects.ts` (9).

### Selezione batch (READ-only, min-consumer)
`src/v2/hooks/useSmartSuggestions.ts`: 6 count()-head-only inline su tabelle diverse. Un solo consumer, badge/suggerimenti, nessun writer, chiaramente idempotente.

### Matrice migrazione
| Call-site | Tabella | Op | Rischio | Azione |
|---|---|---|---|---|
| useSmartSuggestions:32 | agent_tasks | count | basso | → DAL |
| useSmartSuggestions:34 | channel_messages | count | basso | → DAL |
| useSmartSuggestions:36 | mission_actions | count | basso | → DAL |
| useSmartSuggestions:38 | outreach_schedules | count | basso | → DAL |
| useSmartSuggestions:40 | email_drafts | count | basso | → DAL |
| useSmartSuggestions:42 | download_jobs | count | basso | → DAL |

Nessun cambio filtro. RLS invariata. React Query key (`["v2", "smart-suggestions"]`) preservata.

### File toccati
- `src/data/smartSuggestionCounts.ts` (NEW · 80 LOC · DAL aggregatore, propagazione errori, no fallback silenzioso)
- `src/v2/hooks/useSmartSuggestions.ts` (MOD · rimosso import client, sostituito Promise.all inline con `fetchSmartSuggestionCounts`)
- `src/data/__tests__/smartSuggestionCounts.test.ts` (NEW · 3 test: primary path, propagazione errore, guardrail no-bypass sul hook)

### Delta metrica
- **Prima**: 294 · **Dopo**: 288 · **Delta**: **−6 bypass** (−2,04%)
- Distribuzione dopo: `supabase.from` 181 / `untypedFrom` 74 / `tFrom` 11 / `supabase.rpc` 10

### Verifiche
- `bunx tsgo --noEmit` ✅
- `bunx eslint` sui file toccati ✅ (0 nuovi warning)
- `bunx vitest run src/data/__tests__/smartSuggestionCounts.test.ts` ✅ 3/3
- `bunx vitest run` (full): 3042 pass / 4 flaky pre-esistenti (cestinone, dalArchitecture partners/contacts, messaging-ssot, AgentVoiceCall) — tutti verdi in isolamento (`10.78s`). Sono timeout indotti dalla lunghezza della suite (transform 112s), non causati dal batch.
- `bunx vite build` ✅

### Rischio & rollback
- Rischio residuo: nullo sul comportamento utente (stessi filtri, stessa key, no fallback).
- Rollback: `git revert` del batch — un file nuovo + una MOD ristretta.

### Punteggio (conservativo)
- Area A (Architettura/modularità) 74 → **74,5** (bypass 294→288, −2%).
- Nessun altro asse toccato — non gonfio UX/AI/Sicurezza/etc.
- Totale ponderato: 74.720 → **~74.760 / 100.000** (Δ +40 punti; l'impatto reale su 9/10 arriverà con l'accumulo di batch D2…Dn).

### Esito
**GO** — batch reversibile, delta reale misurato, zero regressioni introdotte.

---

## D1.1 — Micro-gate stabilizzazione test (commit 3dd2bdc)

**Causa radice**: molte suite DAL/governance usano `await import()` di moduli pesanti. Il transform Vite SSR a freddo, sotto carico parallelo (transform cumulato ~50–110s, environment ~10.000s), supera il `testTimeout` default di 5s → flaky intermittenti su: `cestinone`, `dalArchitecture` (partners/contacts), `messaging-ssot-governance`, `AgentVoiceCall`, `agentAvatars`, `agentSimulator`, `aiTestScenarios`. Non è un bug runtime né un leak di mock/timer: gli stessi moduli si caricano regolarmente in isolamento.

**Fix** (test-infrastructure only, `vitest.config.ts`):
- `testTimeout: 30_000`, `hookTimeout: 30_000`.
- Nessun `skip`/`todo`/retry, nessuna modifica ad assertion, nessun cambio di codice production.

**Prove**:
- Run A completo: 380 file, 3046 passed, 2 skipped, **0 failed**, 214s.
- Run B completo: 380 file, 3046 passed, 2 skipped, **0 failed**, 219s.
- Typecheck: OK. Lint: 0 errori (233 warning invariati). Build: OK.

**Rollback**: rimuovere `testTimeout`/`hookTimeout` da `vitest.config.ts` (default 5s).

**Verdetto**: GO. Punteggio invariato (miglioramento minimo CI/stabilità).

---

## PROGRAMMA 90K — Batch D2 · Riduzione bypass DAL (READ-only)

Base: `dc526ca583bfdf84922e78e808b6f6248181f511`. D1.1 GO confermato.

### Metrica riproducibile
Stesso comando D1 (`/tmp/dal_metric.sh`).

### Baseline (pre-D2)
- **Totale bypass**: **288** call-site (identica a "dopo D1", riprodotta).
  - `supabase.from`: 186 · `untypedFrom`: 77 · `tFrom`: 14 · `supabase.rpc`: 12

### Selezione batch (READ-only, min-consumer)
`src/v2/hooks/useCampaignDraftsV2.ts` → funzione `useCampaignStatsV2`: 3 count-head-only inline su `email_campaign_queue` (×2) + `email_drafts`. Consumer badge/stat card, nessuna scrittura, nessun contesto mailbox. Non tocco `useCampaignDraftsV2()` (select complesso) né `pause/resume` (writer) — fuori scope batch.

### Matrice migrazione
| Call-site | Tabella | Filtro | Op | Rischio | Azione |
|---|---|---|---|---|---|
| useCampaignDraftsV2.ts:40 | email_campaign_queue | status='sent' | count head | basso | → DAL |
| useCampaignDraftsV2.ts:41 | email_campaign_queue | status='pending' | count head | basso | → DAL |
| useCampaignDraftsV2.ts:42 | email_drafts | queue_status='completed' | count head | basso | → DAL |

Filtri, select, ordine, error semantics (silent `?? 0` sui null count → mantenuto) invariati. React Query key `["v2","campaign-stats"]` preservata. Nessun retry aggiunto.

### File toccati (4)
- `src/data/campaignStats.ts` (NEW · 46 LOC · DAL aggregatore, propagazione errori esplicita)
- `src/v2/hooks/useCampaignDraftsV2.ts` (MOD · rimosso blocco inline dallo stat hook, import DAL)
- `src/data/__tests__/campaignStats.test.ts` (NEW · 3 test: primary+null→0+filtri, propagazione errore, guardrail no-bypass sullo stat hook)
- `.lovable/plan.md` (MOD · questo entry)

### Delta metrica
- **Prima**: 288 · **Dopo**: 285 · **Delta**: **−3 bypass** (−1,04%)
- Distribuzione dopo: `supabase.from` 183 / `untypedFrom` 77 / `tFrom` 14 / `supabase.rpc` 12

### Verifiche
- `bunx tsgo --noEmit` ✅
- `bunx eslint` sui file toccati ✅ (0 nuovi warning/errori)
- `bunx vitest run src/data/__tests__/campaignStats.test.ts` ✅ 3/3
- Suite COMPLETA Run A: 381 file / **3049 passed** / 2 skipped / **0 failed** — 196s
- Suite COMPLETA Run B: 381 file / **3049 passed** / 2 skipped / **0 failed** — 210s
- `bunx vite build` ✅
- DB read-only: `email_campaign_queue` e `email_drafts` → RLS ENABLED, 4 policy cad. Nessuna migration/schema/policy modificata in questo batch.

### Rischio & rollback
- Rischio residuo (post D2.1): nullo. Equivalenza osservabile completa — filtri, select, query key, e semantica errori identici all'inline originario.
- Rollback: `git revert` del batch — 2 file nuovi + 1 MOD ristretta.

### Punteggio (conservativo)
- Area A (Architettura/modularità) 74,5 → **74,6** (bypass 288→285, −1%).
- Totale ponderato: ~74.760 → **~74.780 / 100.000** (Δ +20).

### Esito
**GO condizionato → GO pieno solo dopo D2.1**. D2 in isolamento cambiava la semantica errori (propagazione via `throw` vs. silenziamento inline): variazione runtime osservabile su React Query (`isError`, retry, logging). Accettabile solo con D2.1 applicato.

---

## D2.1 — Correzione equivalenza semantica errori (micro-gate)

Base: `f95a0449116ef28acdac7127180f828e90fd0d87`.

### Motivazione
D2 introduceva `throw firstError` nel DAL, mentre l'inline originario ignorava `error` e restituiva `count ?? 0`. React Query avrebbe attivato `isError`, retry policy e logging — cambiamento runtime osservabile che viola il vincolo di equivalenza.

### Modifiche (3 file, nessun'altro)
- `src/data/campaignStats.ts`: rimossa la propagazione (`firstError`/`throw`). Ripristinata semantica `count ?? 0` anche in presenza di `error`. Commento header aggiornato per documentare la scelta intenzionale di silenziamento (specchio dell'inline).
- `src/data/__tests__/campaignStats.test.ts`: sostituito il test "propaga il primo errore" con test di **equivalenza**: response con `error` + `count=null` → campo restituisce `0`; altri count preservati; nessun throw. Guardrail no-bypass invariato.
- `.lovable/plan.md`: questo entry + correzione affermazioni errate in D2.

### Verifiche
- Vitest mirato `src/data/__tests__/campaignStats.test.ts`: 3/3 ✅
- Typecheck ✅ · Lint mirato ✅ · Build ✅
- Suite completa Run A: 3049 passed / 0 failed / 2 skipped (invariato)
- Suite completa Run B: 3049 passed / 0 failed / 2 skipped (invariato)
- Bypass DAL: **285** (stesso script D1/D2, invariato).
- DB read-only: `email_campaign_queue` e `email_drafts` RLS ENABLED, 4 policy cad. Nessuna migration/schema/policy toccata.

### Esito D2 + D2.1
**GO pieno** — equivalenza osservabile provata. Fermo prima di D3.

---

## PROGRAMMA 90K — Batch D3 · Riduzione bypass DAL (READ-only)

Base: `57c52f548c0dd90c6cad69384a95e1e79a43435a`. D2+D2.1 GO pieno confermato.

### Metrica riproducibile
Stesso comando D1/D2 (`/tmp/dal_metric.sh`). Metrica primaria per **linee uniche**:
`bash /tmp/dal_metric.sh | awk -F: '{print $1":"$2}' | sort -u | wc -l`.

### Baseline (pre-D3)
- Totale bypass (linee uniche): **285** — coincide con il totale non-dedup (nessuna linea contiene più match).

### Selezione cluster
`src/hooks/useRADashboard.ts` → hook singolo, 7 chiamate `untypedFrom(...)` READ-only (4 count + 3 select) su `ra_prospects` (×6) e `ra_scraping_jobs` (×1). Nessuna scrittura, nessun contesto auth/permessi/mailbox, nessuna logica commerciale, nessuna UX critica (dashboard stats card). Cluster omogeneo, singolo file consumer.

### Matrice migrazione (7 call-site)
| # | Table | Select | Filtri | Order/Limit | Uso |
|---|---|---|---|---|---|
| 1 | ra_prospects | `*` head+count exact | — | — | totalProspects |
| 2 | ra_prospects | `*` head+count exact | `not(email,is,null)` | — | withEmail |
| 3 | ra_prospects | `*` head+count exact | `not(pec,is,null)` | — | withPec |
| 4 | ra_prospects | `*` head+count exact | `not(phone,is,null)` | — | withPhone |
| 5 | ra_prospects | `*` | — | `order(created_at desc) limit(10)` | recentProspects |
| 6 | ra_scraping_jobs | `*` | `in(status,[pending,running])` | `order(created_at desc) limit(5)` | activeJobs |
| 7 | ra_prospects | `codice_ateco, descrizione_ateco` | — | — | topAteco map (top 5 desc) |

**Semantica errori (invariante)**: l'inline NON leggeva `error`. Count `null` → `0`, data `null` → `[]`. Il DAL preserva identico silenziamento intenzionale. Nessun throw/retry/logging aggiunto.

**React Query**: `queryKey ["ra-dashboard"]` invariato. `staleTime 30_000` invariato. Nessuna modifica a cache/subscription.

**Mapping ateco**: identico — Map accumulator, skip `!codice_ateco`, fallback `descrizione_ateco ?? codice_ateco`, sort desc, slice(0,5).

### File toccati (4)
- `src/data/raDashboard.ts` (NEW · DAL tipizzato specifico, non generic abstraction · commento header documenta silenziamento intenzionale).
- `src/hooks/useRADashboard.ts` (MOD · corpo del `queryFn` sostituito da `fetchRaDashboardStats()`, tipi RAProspect/RAScrapingJob non più necessari nell'hook).
- `src/data/__tests__/raDashboard.test.ts` (NEW · 3 test: aggregazione + filtri/ordine + mapping ateco; equivalenza errori silenziati; guardrail no-bypass).
- `.lovable/plan.md` (MOD · questo entry).

### Delta metrica
- **Prima**: 285 · **Dopo**: **278** · **Delta**: **−7 bypass** (−2,46%)
- Cumulativo D1+D2+D3: 294 → 278 (**−16**, −5,44%).

### Verifiche
- Vitest mirato `src/data/__tests__/raDashboard.test.ts`: **3/3** ✅ (include mapping ateco, filtri esatti, ordine, equivalenza semantica errori).
- `bunx tsgo --noEmit` ✅
- Lint mirato sui 3 file: 0 nuovi warning/errori ✅
- Suite completa Run A: **382 file / 3052 passed / 2 skipped / 0 failed** — 234s (+1 file, +3 test vs D2.1; nessun nuovo skip).
- Suite completa Run B: **382 file / 3052 passed / 2 skipped / 0 failed** — 242s.
- `bunx vite build` ✅

### DB read-only
- `ra_prospects`, `ra_scraping_jobs`: **non esistono** nello schema public (tabelle "future/untyped" — `untypedFrom` esisteva proprio per questo). Nessun rischio RLS/policy. Nessuna migration/schema/policy toccata da questo batch.
- Diff cambia solo i 4 file dichiarati. Nessun file `supabase/migrations/**`.

### Rischio & rollback
- Rischio residuo: nullo. Semantica byte-for-byte concettualmente identica: stesse chiamate al builder, stessi filtri/ordine/limit, stesso mapping ateco, stesso silenziamento errori, stessa React Query key e staleTime. La chain di `.select(...).not(...).order(...).limit(...)` è preservata parola per parola.
- Rollback: `git revert` del batch (1 NEW hook DAL + 1 MOD hook consumer + 1 NEW test + 1 MOD plan).

### Punteggio (conservativo)
- Area A (Architettura/modularità): 74,6 → **74,7** (bypass 285→278, +7 in un file critico).
- Totale ponderato: ~74.780 → **~74.820 / 100.000** (Δ +40).

### Esito
**GO pieno** — equivalenza semantica preservata (inclusa gestione errori silenziosa), delta reale misurato, suite verde riproducibile, DB invariato. Fermo prima di D4.
