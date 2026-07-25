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
