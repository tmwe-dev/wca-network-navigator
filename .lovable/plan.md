
# Sezione 1 — Implementazione Full (codex + test)

## Stato

- Migration `ai_extract_cache` già applicata (tabella tecnica, RLS lockdown, service_role only).
- Resto da implementare in 3 commit atomici (Enterprise Method Vol II: mai mescolare refactor + fix).

---

## Commit 1 — Pulizia low-risk (Step B + E + F + G)

### E. `scrape-website` payload modulare
- Parametro nuovo `include?: Array<'meta'|'headings'|'links'|'rawText'|'emails'|'phones'|'selectors'>` (default `['meta','emails','phones']`).
- Parametro nuovo `rawTextCap?: number` (default 8000, Sherlock passerà 4000).
- Parsing HTML resta full (la cache `scrape_cache` salva sempre payload completo), ma la risposta è filtrata.
- Backward-compat totale: chiamanti senza `include` ricevono i campi che usavano prima (meta+emails+phones, headings/links/rawText spariscono dalla risposta default → verificheremo callers).

### B. `sherlock-extract` cache via `ai_extract_cache`
- Cache key = `sha256(url + extract_prompt + sorted(target_fields))`.
- Cache hit → ritorna risultato senza chiamare AI. Marca `fromCache: true`.
- Cache miss → chiama AI, salva risultato con TTL 7gg.

### F. `batch-enrichment-worker` snello
- Rimuovi re-check per-row (filtro `enrichment_data IS NULL` già nella SELECT iniziale).
- `BATCH_SIZE`: 5 → 8.
- Sleep adattivo: salta sleep se chiamata enrich ha richiesto > `RATE_LIMIT_MS`.
- Wall-clock cap invariato a 50s.

### G. Dead code BYOK/credit
- Rimuovi `getUserId`/`isByok`/`consumeCredits` da `enrich-partner-website` (~60 LOC).
- Kill-switch `AI_USAGE_LIMITS_ENABLED` rende questo codice morto già adesso; resta `callLLM` shared se mai si riattiva.

### Test Commit 1
- `supabase/functions/scrape-website/index_test.ts` (nuovo): `include=['meta']` → no `rawText`; `include` invalid → default; cache hit ritorna filtrato.
- `supabase/functions/sherlock-extract/index_test.ts` (nuovo): cache miss → AI call; cache hit → no AI call (mock fetch contatore).
- `supabase/functions/batch-enrichment-worker/index_test.ts` (nuovo): BATCH_SIZE rispettato; sleep adattivo skippato se durata > RATE_LIMIT_MS.

---

## Commit 2 — Loader operative_prompts (Step D)

### Modifiche a `_shared/operativePromptsLoader.ts`
- Aggiungo scope `"partner-enrichment"` e `"inbound-enrichment"` a `PromptScope` + `SCOPE_MAP`.

### Migration #2 (rows in `operative_prompts`)
- Seed 2 prompt:
  - `"Partner Website Analyst"` (scope `partner-enrichment`, tag `OBBLIGATORIA`) — sostituisce system prompt inline in enrich-partner-website (e poi sherlock-extract chiamato da pipeline enrichment).
  - `"Inbound Email Classifier"` (scope `inbound-enrichment`, tag `OBBLIGATORIA`) — sostituisce `PROMPT_SYSTEM` di `process-inbound-enrichment`.
- Entrambi seguono Standard Professore (Identità/Obiettivo/Metodo/Guardrail/Output).

### Codice
- `process-inbound-enrichment`: carica prompt via loader, fallback al testo attuale se DB vuoto (zero downtime).
- `sherlock-extract`: opzionale — accetta `scope?: PromptScope`; se passato, prepende prompt operativi al system. Default invariato.

### Test Commit 2
- `process-inbound-enrichment` test: prompt caricato sostituisce default; loader vuoto → fallback.
- Loader test esistente (`operativePromptsLoader`?) — se non esiste, skip (loader già coperto da uso in altri 6 edge).

---

## Commit 3 — Kill `enrich-partner-website` (Step A)

### Trasformazione in thin proxy
- `enrich-partner-website/index.ts` resta come endpoint per compatibilità (`batch-enrichment-worker`, `useAcquisitionPipeline`).
- Internamente:
  1. Carica partner (id, company_name, website, country, city).
  2. Chiama `scrape-website` con `include=['meta','headings','rawText']`, `rawTextCap=4000`.
  3. Chiama `sherlock-extract` con `target_fields=['revenue_estimate','employee_count','founding_year','has_own_fleet','fleet_details','has_warehouses','warehouse_sqm','warehouse_details','additional_services','key_markets','key_routes','summary_it']` e prompt da Prompt Lab (scope `partner-enrichment`).
  4. Salva `enrichment_data` + trigger `triggerQualityScoreRecalculation` (invariato).
- Risultato: ~336 LOC → ~120 LOC. AI call duplicata eliminata. Cache Sherlock copre re-run.

### `batch-enrichment-worker`
- Invariato (chiama lo stesso endpoint, ora più leggero).

### Test Commit 3
- Adatta `enrich-partner-website/index_test.ts` esistente al nuovo flusso (mock di scrape-website + sherlock-extract).
- Smoke test end-to-end via `curl_edge_functions` su 1 partner reale (post-deploy).

---

## Out of scope (rinviato a P2)

**Step C (consolidamento hook frontend)** — `useDeepSearchLocal`, `useDeepSearchRunner`, `useDeepSearchExtraSources`, `useFireScrapeExtensionBridge`, `useSherlock` toccano UI live (FireScrape Canvas, Deep Search Panel, Sherlock 3-livelli). Richiede QA visuale dedicato. Lo apriremo dopo Sezione 8 dell'audit.

---

## Stima impatto consolidato

| Metrica | Prima | Dopo Commit 1-3 | Δ |
|---|---|---|---|
| LOC edge functions Sez.1 | ~2 437 | ~1 720 | −30% |
| Token medio enrichment partner | ~12 000 | ~6 000 | −50% |
| AI call duplicate per partner | 2 (scrape→AI + enrich→AI) | 1 | −50% |
| Throughput cron enrichment | 4-5/ciclo | 8-10/ciclo | +60% |
| Prompt editabili da Prompt Lab | 0/3 | 3/3 | governance allineata |

---

## Memorie da aggiornare al termine

- Nuova memoria: `mem://architecture/enrichment-pipeline-unified-2026-05-23` — pipeline scrape→sherlock unica, cache `ai_extract_cache`, `enrich-partner-website` proxy.
- Update index: marca `enrich-partner-website` come PROXY (non più LEGACY).

---

## Esecuzione

Procedo autonomamente Commit 1 → 2 → 3 con test verdi tra l'uno e l'altro. Mi fermo solo se un test fallisce o un caller non documentato si rompe (in tal caso rollback del singolo commit e segnalazione).
