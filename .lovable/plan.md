

# Piano P0.2 → P1.3 — Sblocchi e diagnosi V2

P0.1 già completato (tabella `email_send_log` + retrofit fire-and-forget). Procediamo con i 5 step rimanenti, ognuno atomico.

## Stato accertato dalla diagnosi preliminare

- `app_settings` ha **alcune** chiavi WA/LI globali già presenti (`linkedin_send_start_hour`, `linkedin_send_end_hour`, `linkedin_min_delay_seconds`, `linkedin_max_delay_seconds`, `linkedin_daily_limit`, `linkedin_hourly_limit`, `linkedin_bulk_max`) ma **mancano**: `whatsapp_send_*`, `whatsapp_*_limit`, `whatsapp_min/max_delay`, `whatsapp_cadence_days`, `linkedin_max_message_length`, `linkedin_cadence_days`. `ON CONFLICT DO NOTHING` lascerà intatti i valori esistenti.
- `operative_prompts` **non ha colonna `scope`** (ha `context`). Il codebase NON cerca `scope` su `operative_prompts` (verificato: nessun match). DAL legge correttamente `context`.
- `email_prompts` **ha `scope`** (CHECK `address|category|global`). Il codebase usa correttamente `scope`. Tabella vuota.
- Agenti duplicati: solo `1d51961d…` ha 2 attivi con stesso nome (`marco` lowercase + `Luca/Marco/Sara` già disattivati). L'utente `fe1db58a…` ha 4 record disattivi duplicati. Marco user `1d519…` ha **1 attivo + 1 inattivo** stesso nome → niente da fare. **Verifica reale**: nessun gruppo (user_id, name) ha >1 attivo. La dedup è già di fatto fatta, ma puliamo i `name` con suffisso `[DUP]` sui disattivati duplicati e normalizziamo.
- Cron jobs **già attivi**: `agent_autopilot_worker_tick` ogni 10 min (`succeeded` ultimo run alle 07:00), `agent_autonomous_cycle_tick` ogni 2 min, `outreach_scheduler_tick` ogni minuto, ecc. **Il worker GIRA**. Il problema non è cron.
- agent_tasks: 1584 pending (era 1539, sale → l'autopilot accoda, l'esecutore non drena), 1582 hanno `agent_id` di agente attivo, solo 2 orfani. Schema agent_tasks **non ha** `locked_at` né `updated_at`.

## P0.2 — Settings WhatsApp/LinkedIn mancanti

**Solo INSERT** in `app_settings` (user_id NULL, ON CONFLICT DO NOTHING). Niente schema change.

Chiavi nuove da inserire:
- WA: `whatsapp_send_start_hour=8`, `whatsapp_send_end_hour=21`, `whatsapp_daily_limit=200`, `whatsapp_hourly_limit=20`, `whatsapp_min_delay_seconds=4`, `whatsapp_max_delay_seconds=12`, `whatsapp_cadence_days=7`
- LI: `linkedin_max_message_length=300`, `linkedin_cadence_days=7` (le altre 6 esistono già — `ON CONFLICT DO NOTHING` le rispetta)

Servono unique constraint? Verifico: la tabella ha `id` PK ma non c'è UNIQUE su `(key, user_id)` visibile. Per evitare duplicati uso pattern `INSERT … WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key=… AND user_id IS NULL)`.

`MultichannelTimingPanel` legge già da `useSettingsV2` → user-scoped settings con fallback ai default hard-coded. Una volta inseriti i globali, il panel continua a usare i suoi default UI ma quando l'utente salva i propri valori vanno nel suo scope.

**Nessuna modifica codice TS in P0.2.** Solo seed DB.

## P0.3 — Rinomina duplicati agenti già disattivati

Stato reale (per (user_id, name) attivo): nessun gruppo con >1 attivo. La dedup logica è OK.

Da fare: per i record `is_active=false` che hanno omonimo attivo nello stesso `user_id`, aggiungere suffisso ` [DUP]` al nome se non già presente. Vincolo `no-physical-delete` rispettato.

UPDATE chirurgico (un solo statement):
```sql
UPDATE agents a SET name = a.name || ' [DUP]'
WHERE a.is_active = false
  AND name NOT LIKE '% [DUP]'
  AND EXISTS (SELECT 1 FROM agents b WHERE b.user_id = a.user_id AND b.name = a.name AND b.is_active = true AND b.id <> a.id);
```

Per il caso `fe1db58a…` (4 disattivi senza alcun attivo per stesso nome): se non c'è "vincitore attivo", li lasciamo intatti (non sono duplicati di un attivo, sono record morti — cura cosmetica solo se richiesto).

**Nessuna modifica codice.** Solo UPDATE DB.

## P1.1 — Fix `operative_prompts.scope` → `.context`

Dopo audit: **nessun file referenzia `scope` su `operative_prompts`**. Tutte le query usano `context` (corretto).

Email_prompts: tutte le query usano `scope` (corretto: la tabella ha `scope`).

Output P1.1: report di non-azione. **Nessuna modifica.** Documenterò in `docs/audit/AUDIT-FLUSSI-FONDAMENTALI-2026-04-24.md` che la verifica è negativa.

## P1.2 — Diagnostica 1584 agent_tasks pending (read-only)

Devo ispezionare:
1. `supabase/functions/agent-autopilot-worker/index.ts` — verificare: lettura `ai_automations_paused`, finestra oraria, `approval_required`, query SELECT su `agent_tasks` (filtri usati), batch size, gestione `started_at/completed_at` come signal di lock.
2. `cron_job_status()`: già fatto. Worker schedulato ogni 10 min, ultimo run `succeeded`.
3. Edge function logs ultimi run worker per capire se trova 0 task o le scarta.
4. Distribuzione pending per `task_type` e `agent_id` — capire se filtro su tipo le esclude.
5. `app_settings` rilevanti: `agent_max_actions_per_cycle`, `agent_require_approval`, `agent_work_start_hour/end_hour`, `ai_automations_paused`.

Output: report scritto in `docs/audit/AUTOPILOT-DIAGNOSIS-2026-04-24.md` con risposte alle 8 domande del brief. **Nessuna modifica.**

## P1.3 — Seed `email_prompts`

User principale = `27b60e53-eab1-4528-9e9c-f19c5c7dae90` (1100 activities, top).

INSERT 3 prompt globali (`scope='global'`, `is_active=true`, priorità 10/5/5). Pattern `WHERE NOT EXISTS` su `(user_id, scope, title)` per idempotenza (la tabella non ha unique constraint visibile).

**Nessuna modifica codice.** Solo seed DB.

## Esecuzione

Esegui i passi nell'ordine: **P0.2 → P0.3 → P1.1 → P1.2 → P1.3**, ciascuno con conferma prima del successivo. Tutti tranne P1.2 sono operazioni DB veloci. P1.2 produce documento.

## File toccati

- DB: 3 INSERT/UPDATE (P0.2, P0.3, P1.3) — niente migration, solo dati.
- `docs/audit/AUDIT-FLUSSI-FONDAMENTALI-2026-04-24.md` — aggiornato con esito P1.1.
- `docs/audit/AUTOPILOT-DIAGNOSIS-2026-04-24.md` — nuovo, output P1.2.
- Codice TS/Edge: **zero** modifiche. Tutti gli step rimanenti sono dati o documentazione.

## Vincoli rispettati

- `no-physical-delete`: solo `is_active=false` + rename suffisso, mai DELETE.
- `whitelist-email-auth-standard`: nessun cambio auth.
- DAL pattern: nessuna nuova query Supabase fuori da `src/data/`.
- Architecture layer rules: nessuna modifica a layer V1/V2.

