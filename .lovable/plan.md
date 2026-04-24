

# P3 — Stabilizzazione e Hardening

Lavoro in 9 task indipendenti. Ognuna chiude un buco critico individuato nell'audit.

## P3.1 — Fix invii email + reset draft in errore

**Stato attuale (verificato):**
- `email_drafts`: 4 in `status='error'`, 1 in `queued/idle`. Nessuna colonna `error_message` su questa tabella (è solo su `email_campaign_queue`).
- `email_campaign_queue`: 4 righe totali — 2 `sent`, 2 `failed`. Le 2 fallite hanno `error_message = "supabase.rpc(...).catch is not a function"` e risalgono al **5 aprile** (18 giorni fa).
- `app_settings` SMTP: credenziali presenti per due utenti (`luca@tmwe.it`, `luigi@tmwe.it`), host/port/password compilati. **SMTP non è il blocco**.

**Diagnosi:** il vecchio bug era una `.catch()` chainata su una promise Supabase (che non espone `.catch` come metodo). Nel codice attuale di `process-email-queue` quel pattern non c'è più — l'errore è stato risolto in passato ma i 4 draft sono rimasti "appesi" in stato `error`.

**Azioni:**
1. Migration: `UPDATE email_drafts SET status='draft', queue_status='idle' WHERE status='error'` (così l'utente può rilanciare).
2. Migration: `UPDATE email_campaign_queue SET status='pending', error_message=NULL, retry_count=0 WHERE status='failed' AND error_message LIKE '%catch is not a function%'`.
3. Audit ricerca residui `.rpc(...).catch(` in tutto `supabase/functions/` (già fatto: 0 occorrenze, sano).

## P3.2 — Riattivare IMAP sync

**Stato verificato:**
- Cron `email-sync-worker` esiste già (`*/3 * * * *`, jobid 36) e `email_cron_sync_tick` (`*/5 * * * *`, jobid 29). Schedulati e con auth header inline corretto.
- Ultimo `email_sync_jobs` completato 20 giorni fa. **Non ci sono job in stato `running`** → il worker tick trova "No running jobs" e esce subito (verificato dai log).

**Diagnosi:** il worker non crea job da solo, drena solo quelli `running`. L'utente deve avviare un job. La UI esiste ma probabilmente nessuno l'ha riavviata dopo la finestra di interruzione.

**Azioni:**
1. Invocare manualmente `email-sync-worker` per confermare che gira (sarà no-op).
2. Creare un `email_sync_jobs` di test in `status='running'` per l'utente principale, con limite basso (es. 50 email), per verificare end-to-end.
3. Verificare il risultato dopo 10 minuti: `downloaded_count` deve incrementare e/o `status='completed'`.
4. Se la creazione del job manuale non basta, controllare che la UI "Sync inbox" in `EmailMailboxPage` sia accessibile e funzionante.

## P3.3 — Job batch enrichment automatico

**Stato verificato:** 1/12.286 partner arricchiti (peggio del previsto), 12.263 hanno `website`.

**Azioni:**
1. Nuova edge function `batch-enrichment-worker`:
   - Pesca 5 partner: `enrichment_data IS NULL OR enrichment_data='{}'::jsonb`, `website IS NOT NULL`, `is_active=true`, `deleted_at IS NULL`, ordinati per `rating DESC NULLS LAST`.
   - Per ognuno: invoca `enrich-partner-website` con `partnerId`. Try/catch isolato per partner.
   - Rate limit: `await sleep(10000)` tra una chiamata e l'altra.
   - Wall clock cap 50s (esce prima dei 60s del runtime).
   - Skip immediato se nel frattempo qualcuno ha già popolato `enrichment_data`.
2. Schedulazione cron `*/30 * * * *` con auth header anon inline (pattern P2.D).
3. Output JSON: `{processed, skipped, errors[]}`.

**Vincoli:** nessuna sovrascrittura, fire-and-forget, log strutturato per errore.

## P3.4 — Parser Factory robusto AI

**Stato:** 4 funzioni (`generate-email`, `generate-outreach`, `classify-email-response`, `improve-email`) parsano output AI senza fallback.

**Azioni:**
1. Nuovo file `supabase/functions/_shared/responseParserFactory.ts`:
   - `stripMarkdownFences(text)` — rimuove ` ```json ` e ` ``` `.
   - `sanitizeForFallback(text)` — rimuove tag pericolosi, tronca a 5000 char.
   - `parseEmailResponse(raw, model, fnName)` — estrae `subject`/`body`. Fallback `{subject: "Follow-up", body: sanitized}`.
   - `parseClassification(raw, model, fnName)` — JSON.parse + valida enum category + clamp confidence 0-1. Fallback `{category: "uncategorized", confidence: 0.1, sentiment: "neutral"}`.
   - Ogni fallback: `console.error("[PARSE_FAIL]", fnName, model, raw.slice(0,200))`.
2. Integro nei 4 file mantenendo l'output esistente (solo wrap con try/catch + fallback).
3. Deploy delle 4 funzioni.

**Verifica post-deploy:** test manuale via `curl_edge_functions` con input volutamente malformato.

## P3.5 — Typed Supabase Query Builders

**Stato:** ~570 occorrenze di `as any`/`as unknown as` in `src/data/`.

**Azioni (incrementali, una alla volta con build verificata):**
1. Nuovo file `src/lib/supabaseQueryBuilders.ts`.
2. Refactor in ordine, uno per commit logico:
   - `partners.ts` (più occorrenze): builder `selectPartners(filters)` tipizzato `Promise<PartnerWithRelations[]>`. Cast UNICO interno.
   - `outreachTimingTemplates.ts`, `downloadJobs.ts`, `channelMessages.ts`, `outreachPipeline.ts`, `contacts/queries.ts`: stesso pattern.
3. Per JSONB: ad-hoc helper, ma vero wrapping in P3.6.
4. Per RPC non in types (`apply_lead_status_rpc`): un helper `applyLeadStatus(table, id, status)` che incapsula il singolo cast.

**Vincolo:** zero cambi di logica, build passa dopo ogni file.

## P3.6 — TypedJson + return type esplicito

**Azioni:**
1. Nuovo `src/types/json.ts` con interfacce `EnrichmentData`, `AgentStats`, `ScheduleConfig` e wrapper `TypedJson<T>`.
2. Refactor in ordine: `downloadJobs.ts`, `aiConversations.ts`, `useEnrichmentData.ts`, `useDeepSearchRunner.ts`.
3. Aggiungo return type esplicito (`Promise<PartnerRow[]>`) sulle funzioni data che oggi castano lato consumer. Cast UNICO interno alla funzione (`as PartnerRow[]`), niente `as unknown as` nei consumer.

**Verifica:** `tsc --noEmit` pulito + count `as unknown as` ridotto.

## P3.7 — Eliminare codice morto viste DB

**Stato verificato:** 126 match in 10 file per le 4 viste e l'RPC `apply_lead_status_rpc`. ATTENZIONE: l'RPC `apply_lead_status_rpc` è **realmente in uso** (route LeadProcessManager) — verifico in DB se esiste prima di rimuoverlo.

**Pre-azione:** check `pg_proc` per `apply_lead_status_rpc`. Se esiste → mantenere, solo eliminare il cast `as any` aggiungendo tipi corretti. Se non esiste → confermare con utente prima di rimuovere chiamate.

**Azioni viste mancanti (`v_kpi_dashboard`, `v_inbox_unified`, `v_outreach_today`, `v_pipeline_lead`):**
1. Per ogni call site: rimuovo cast `(supabase as any).from("v_…")` e sostituisco con query equivalente sulle tabelle base + aggregazione lato client (oppure RPC dedicata).
2. Per `v_kpi_dashboard` (in `src/data/analytics.ts` e `src/v2/io/supabase/queries/dashboard.ts`): sostituisco con N count query separati (è il pattern già esistente come fallback).
3. Per `v_pipeline_lead` (in `partners.ts`, usata da AgendaListView): query diretta a `partners` + join `activities` lato client per `touch_count`/`last_outbound_at`.
4. Per `v_outreach_today` (in `outreachQueue.ts`): query a `outreach_queue` + join partner.

**Vincolo:** nessuna creazione di viste, fallback grazioso `data ?? []` ovunque.

## P3.8 — Dashboard observability email

**Già implementata.** `EmailObservabilityPanel` esiste in `src/v2/ui/components/dashboard/` e è caricata da `DashboardPage.tsx`. Verifico se copre tutte le metriche richieste:
- Contatori sent/failed ultime 24h ✓ (presunto, verifico al momento del fix se mancante)
- Ultimi 10 invii ✓
- Tasso successo 7d ✓
- Stato vuoto ✓

**Azioni:** se manca qualcuna delle 4 metriche → la aggiungo. Altrimenti **skip P3.8** e segnalo come già fatta.

## P3.9 — Badge diagnostico admin

**Stato:** ruoli admin gestiti via `user_roles` + `has_role` RPC (verificato). Esiste hook `useAuthV2` con `loadRoles`.

**Azioni:**
1. Nuovo componente `src/v2/ui/components/admin/SystemDiagnosticsBadge.tsx`:
   - Visibile solo se `roles.includes('admin')`.
   - Mostra in piccolo: pending counts (`agent_tasks`, `email_campaign_queue`, `extension_dispatch_queue`), cron job count (`SELECT COUNT(*) FROM cron.job` via RPC), last sync (`MAX(created_at) FROM email_sync_jobs WHERE status='completed'`), build URL host.
   - Click → expand con dettagli.
   - Soglie rosso: pending >100, last sync >24h.
2. Nuova RPC `get_system_diagnostics()` (SECURITY DEFINER, restituisce JSON con i counts) — necessaria perché `cron.job` non è leggibile da RLS client.
3. Mounting in `DashboardPage` come slot in alto.
4. Query con `staleTime: 60s`, no polling.

---

## Dettagli tecnici riassunti

- **Migrations DB:** 1 per P3.1 (reset stati), 1 per P3.9 (RPC diagnostics).
- **Nuove edge functions:** `batch-enrichment-worker` (P3.3).
- **Nuovi cron job:** 1 (`*/30 * * * *` per batch enrichment).
- **Nuovi file shared:** `responseParserFactory.ts` (P3.4), `supabaseQueryBuilders.ts` (P3.5), `types/json.ts` (P3.6).
- **Edge functions modificate:** 4 (P3.4) + redeploy.
- **File frontend toccati:** ~10-15 (P3.5+P3.6+P3.7), 1 nuovo (P3.9).

## Ordine di esecuzione consigliato

Blocco A — fix immediati (sblocca utente):  P3.1 → P3.2 → P3.3
Blocco B — resilienza backend:  P3.4
Blocco C — type safety (lungo, incrementale): P3.7 (rimozione viste fantasma) → P3.5 → P3.6
Blocco D — observability admin:  P3.9 (P3.8 già fatto, da verificare)

Procedo con il Blocco A appena confermi.

