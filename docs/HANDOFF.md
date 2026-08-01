# WCA Partner Connect — Handoff operativo

Documentazione minima per gestire il sistema in autonomia (P6.4).

## Cosa fa il sistema da solo

| Componente | Cron | Effetto |
|---|---|---|
| `agent-task-drainer` | ogni 2 min | esegue task pending degli agenti |
| `agent-autopilot-worker` | ogni 10 min | genera task dalle missioni attive |
| `agent-autonomous-cycle` | ogni 2 min | tick autonomo agenti |
| `outreach-scheduler` | ogni minuto | scheduler outreach multicanale |
| `email-sync-worker` | ogni 3 min | drena IMAP sync jobs `running` |
| `email_cron_sync_tick` | ogni 5 min | trigger nuovi sync IMAP |
| `batch-enrichment-worker` | ogni 30 min | arricchisce 5 partner/run (~240/giorno) |
| `cadence-engine` | ogni ora | cadenze outreach |
| `cleanup-cron-runs` | giornaliero | pulisce log cron |

Stato 24h (snapshot 2026-04-24): 2.623/2.623 esecuzioni OK, 0 failed.

## Cose che fai tu

### Creare una missione autopilot
1. `/v2/agents/missions` → "Nuova missione"
2. Compila nome, obiettivo, criteri target (regione, servizi, ecc.), strategia (email / multicanale)
3. Imposta `status = active` → l'autopilot la prende al prossimo tick (max 10 min)
4. Monitora da `/v2/agents/autopilot`

### Leggere il badge diagnostico
- Visibile **solo agli admin** in alto sulla Dashboard.
- Click → mostra: agent_tasks pending, email queue, extension queue, cron attivi, ultima sync email.
- 🟢 verde = tutto ok. 🔴 rosso = soglia superata (>100 pending o sync >24h fa).
- Refresh automatico al focus della finestra.

### Pannelli da consultare
- **Dashboard `/v2`** — stato giornaliero, briefing AI, attività jobs.
- **KPI `/v2/kpi`** — enrichment coverage, deliverability email, response rate, completion rate task, conversion funnel.
- **Email Activity** (in fondo alla Dashboard) — invii recenti, errori, tasso successo per intervallo.
- **Comunica `/v2/outreach`** — composer email, agenda follow-up.
- **Timeline partner** — apri scheda partner per cronologia unificata email/WA/LI.

## Cosa fare se qualcosa rompe

### Un cron job fallisce
1. Apri il badge diagnostico → cron attivi diminuisce? 
2. Query SQL: `SELECT jobname, return_message, start_time FROM cron.job_run_details WHERE status='failed' ORDER BY start_time DESC LIMIT 20`
3. Edge function logs: cerca il nome del job (es. `agent-task-drainer`) nei log Supabase.
4. Fix tipico: redeploy edge function. I cron riprendono al tick successivo.

### Email non parte
1. Apri pannello Email Activity in Dashboard → c'è errore?
2. Query: `SELECT status, error_message FROM email_send_log ORDER BY sent_at DESC LIMIT 5`
3. Se `status='failed'`: leggi `error_message`. Causa più frequente: SMTP credentials in `app_settings`.

### IMAP non riceve
1. Verifica cron `email-sync-worker` attivo (badge → cron count).
2. Query: `SELECT status, downloaded_count, created_at FROM email_sync_jobs ORDER BY created_at DESC LIMIT 5`
3. Se nessun job `running`: trigger manuale dalla UI Comunica → "Sync inbox".

### Task agente stuck
1. Badge → `agent_tasks pending` in rosso (>100)?
2. Query: `SELECT id, status, error_message FROM agent_tasks WHERE status='failed' ORDER BY created_at DESC LIMIT 10`
3. Drainer gira ogni 2 min. Se stuck: redeploy `agent-task-drainer`.

## Limiti noti

| Limite | Valore | Nota |
|---|---|---|
| WhatsApp daily | `wa_daily_limit` in `app_settings` | rate limit account WA |
| LinkedIn daily | `li_daily_limit` in `app_settings` | rischio ban se aggressivo |
| WA delay tra invii | `wa_min/max_delay_seconds` | umanizza pattern |
| LI delay tra invii | `li_min/max_delay_seconds` | umanizza pattern |
| Batch enrichment | 5 partner/run × 30 min | ~240/giorno |
| SMTP daily cap | dipende dal provider | configura in `app_settings` |
| Email queue TTL | 60 min transactional, 15 min auth | espirati → DLQ |

## Routine giornaliera consigliata

1. Apri `/v2` → guarda greeting + briefing AI.
2. Apri il badge diagnostico → tutto verde?
3. Apri `/v2/kpi` → controlla deliverability + response rate ultimi 30gg.
4. Se serve nuova missione → `/v2/agents/autopilot` → "Nuova missione".
5. Per il resto: il sistema lavora da solo.