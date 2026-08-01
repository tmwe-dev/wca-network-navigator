# Ledger riproducibilità migrazioni — 2026-08-01

Audit **offline** (nessuna query/mutazione su produzione) generato da `node scripts/audit-migrations.mjs`.
Gate deterministico: `src/test/migration-audit.test.ts` (ratchet, solo in discesa).

## Sintesi

| Metrica | Valore |
|---|---|
| Migrazioni totali | 416 |
| Naming non standard (prefisso ≠ 14 cifre) | 7 |
| Gruppi di timestamp duplicati | 2 |
| Conflitti di ordinamento | 7 |
| Oggetti alterati prima della creazione | 7 |
| Funzioni SECURITY DEFINER senza search_path | 1 |
| View SECURITY DEFINER dichiarate | 0 |
| CREATE TABLE public senza GRANT nello stesso file | 202 |
| Tabelle nei tipi generati | 282 |
| Tabelle create nelle migrazioni | 229 |
| Presenti nelle migrazioni ma assenti dai tipi | 17 |
| Presenti nei tipi ma senza CREATE TABLE tracciata | 70 |

## 1. Naming e ordinamento

I 7 file seguenti usano un prefisso a 8 cifre (solo data): l'ordine lessicografico
non coincide con l'ordine cronologico reale rispetto ai file a 14 cifre dello stesso giorno.

- `20260423_agent_atlas.sql`
- `20260423_suggested_improvements.sql`
- `20260513_ai_log_enrich.sql`
- `20260513_funnemail_eval.sql`
- `20260513_performance_indexes.sql`
- `20260513_personas_seed.sql`
- `20260513_prompt_test_runs_metadata.sql`

Timestamp duplicati: `20260423` (2 file), `20260513` (5 file).

## 2. Oggetti referenziati prima della creazione

- `20260404040238_e02c7383-518b-4088-8b2d-d85e40688279.sql` → `partners_no_contacts`
- `20260420054805_9279e1ea-0809-482f-bdd6-6ee731c45203.sql` → `extension_dispatch_queue`
- `20260513120400_seed_agent_personas_rich.sql` → `agent_personas`
- `20260513120400_seed_agent_personas_rich.sql` → `agent_personas`
- `20260513_personas_seed.sql` → `agent_personas`
- `20260513_personas_seed.sql` → `agent_personas`
- `20260720085836_1ea04637-805a-488b-b14e-5c8823ce0672.sql` → `reply_classifications`

Sono ALTER su tabelle la cui CREATE TABLE non è presente nella history del repo
(vedi §4): un replay da zero fallirebbe su questi file.

## 3. Sicurezza dichiarata nelle migrazioni

Funzioni SECURITY DEFINER senza `SET search_path`:

- `20260423130000_materialized_read_models.sql` → `refresh_read_models`

Verificato su DB live: `public.refresh_read_models` **non esiste** — la migrazione
`20260423130000_materialized_read_models.sql` non risulta applicata. Nessuna
correzione produttiva necessaria; il gate impedisce nuove occorrenze.

Il linter DB conferma esattamente **2 ERROR security-definer view** e **2 WARN
function search_path mutable**, già coperti dai file correttivi **non applicati**:

- `supabase/migrations-pending/20260801090000_fix_function_search_path.sql` (+ rollback)
- `supabase/migrations-pending/20260801090100_fix_security_definer_views.sql` (+ rollback)

Rinominati a prefisso 14 cifre per rispettare la convenzione. Restano CREATE-ONLY:
nessuna applicazione, nessun deploy, nessuna modifica RLS/permessi.

## 4. Drift storico

70 tabelle presenti nei tipi generati non hanno
CREATE TABLE tracciata nel repo (create prima dell'inizio della history o via tool
di migrazione senza file persistito). Esempi: `agent_action_log`, `agent_knowledge_links`, `agent_mission_events`, `agent_missions`, `agent_personas`, `browser_action_log`, `command_job_steps`, `command_jobs`, `cron_runs`, `extension_dispatch_queue`.

17 oggetti creati dalle migrazioni non compaiono nei tipi
(migrazioni non applicate o oggetti poi rimossi): `ra_prospects`, `ra_contacts`, `ra_scraping_jobs`, `ra_interactions`, `kb_entries_pending_embedding`, `teams`, `domain_events`, `v_pipeline_lead`, `v_inbox_unified`, `v_outreach_today`, `v_kpi_dashboard`, `suggested_improvements`, `pending_suggestions`, `dispatch_integrity_report`, `funnemail_eval_batch_runs`, `rate_limit_violations`, `funnemail_eval_dataset`.

**Conseguenza**: la history NON è replay-safe da zero. Il ripristino affidabile
resta il backup del database, non il replay delle migrazioni.
