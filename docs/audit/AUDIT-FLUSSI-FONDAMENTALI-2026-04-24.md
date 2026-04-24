# Audit Flussi Fondamentali V2 — 2026-04-24

Documento di riferimento per lo sviluppo P0/P1. Snapshot DB live + analisi codice.
Ogni sezione descrive: cosa esiste, stato reale, problemi, azione P0/P1 collegata.

## Indice
1. Email
2. WhatsApp
3. LinkedIn
4. Prompt
5. Arricchimento
6. Automation
7. Roadmap P0/P1

---

## 1. EMAIL

### Codice
- Edge `send-email` (469 righe): SMTP via `denomailer`, journalist review, idempotency tramite `email_campaign_queue`, post-send pipeline, blacklist + email_status guards. Auth via `getClaims`.
- Edge `process-email-queue` (282 righe): batch da 10, controlla pause/cancel su `email_drafts`, idempotency dedup, retry_count, post-send pipeline.
- Hook UI: `useEmailComposerV2` (V2), `useSendEmail` (legacy V1) — chiamano direttamente `send-email`.
- Composer: `EmailComposerPage` interroga `email_prompts WHERE is_active=true`.

### Stato DB
| Tabella | Righe | Note |
|---|---|---|
| `email_send_log` | **NON ESISTE** | Doctrine la richiede; osservabilità email = zero |
| `email_drafts` | 5 | 4 in `error`, 1 `queued`, ultimo 2026-04-06 |
| `email_templates` | 0 | Vuota |
| `email_prompts` | 0 | Vuota → composer mostra sempre lista vuota |
| `email_campaign_queue` | 4 | 2 sent / 2 failed (50% failure) |
| `email_sync_jobs` | 4 | Tutti completed, ultimo 2026-04-04 (~20gg fa) |

### Problemi
- Manca `email_send_log` → no dashboard, no dedup per `message_id`.
- Composer V2 cerca `email_prompts.scope`+`is_active`+`priority`: le prime 2 colonne ci sono, la query ritorna 0 righe perché la tabella è vuota.
- Idempotency riusa `email_campaign_queue` come log: ibrida tabella di coda con audit log → mescola domini.
- IMAP polling fermo da 20 giorni.

### Azioni
- **P0.1**: creare `email_send_log` + retrofit di `send-email` e `process-email-queue` (fire-and-forget).
- **P1.3**: seed 3 prompt globali in `email_prompts`.

---

## 2. WHATSAPP

### Codice
- Edge `send-whatsapp` (258 righe): rate-limit `check_channel_rate_limit` (5/min), gate hard blacklist + `lead_status='blacklisted'`, journalist review, accoda in `extension_dispatch_queue`.
- Edge complementari: `whatsapp-ai-extract`, `receive-channel-message`, `classify-inbound-message`.
- UI: `MultichannelTimingPanel` legge da `useSettingsV2` (hook su `app_settings`). Bridge protocol via estensione browser.

### Stato DB
| Tabella | Righe |
|---|---|
| `extension_dispatch_queue` | 0 (totalmente vuota) |
| `app_settings` chiavi `whatsapp_*` | **NESSUNA** (interrogato 80 chiavi, zero match) |

### Problemi
- Settings WA assenti → il panel scrive ma nulla legge default sani al primo accesso.
- Code totalmente vuote → flow esiste ma non esercitato in produzione recente.
- `MultichannelTimingPanel` chiama `useSettingsV2` che fa `fetchAppSettings()` su tutto il key/value pair: se chiavi non esistono usa fallback hard-coded interno → setup silenzioso, nessuna persistenza visibile finché utente non salva.

### Azioni
- **P0.2**: insert default globali (user_id NULL) per 7 chiavi WA in `app_settings`.

---

## 3. LINKEDIN

### Codice
- Edge `send-linkedin`, `linkedin-ai-extract`, `linkedin-profile-api`, `save-linkedin-cookie`, `save-linkedin-credentials`. Validazione URL `linkedin.com/in/...` obbligatoria (memory).

### Stato DB
| Tabella | Righe |
|---|---|
| `linkedin_flow_jobs` | 0 |
| `linkedin_flow_items` | 0 |
| `app_settings` chiavi `linkedin_*` | **NESSUNA** |

### Problemi
- Stessa situazione WA: settings inesistenti, code vuote.

### Azioni
- **P0.2**: insert default globali per 8 chiavi LI in `app_settings`.

---

## 4. PROMPT

### Codice
- Pagina `PromptLabPage` con tabs/atlas/hooks/utils, `LabAgentChat`, `SuggestionsReviewPage`, `RunHistoryPanel`, contracts derivati da edge functions.
- Edge: `agent-prompt-refiner`, `kb-promoter`, `kb-supervisor`, `unified-assistant`.
- DAL: `src/data/operativePrompts.ts`, `src/data/emailPrompts.ts`.

### Stato DB
| Tabella | Righe | Colonne chiave reali |
|---|---|---|
| `operative_prompts` | 7 | `id, user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active` |
| `prompt_templates` | 0 | — |
| `email_prompts` | 0 | `scope` (CHECK address/category/global), `scope_value`, `title`, `instructions`, `is_active`, `priority` |
| `prompt_lab_global_runs` | ? | con 0 missions probabilmente vuoto |

### Problemi
- `operative_prompts` NON ha colonna `scope` — ha `context`. Eventuali query nel codice che cercano `scope` falliscono o sono assenti.
- `email_prompts` è vuota → composer ritorna sempre `[]`.
- DAL `operativePrompts.ts` legge correttamente `objective`, ma alcuni edge potrebbero filtrare per `scope`.

### Azioni
- **P1.1**: grep `operative_prompts` + `scope` in tutto il codebase, sostituisci con `context` o tag.
- **P1.3**: seed 3 prompt globali in `email_prompts`.

---

## 5. ARRICCHIMENTO

### Codice
- Edge: `enrich-partner-website`, `deep-search-partner`, `deep-search-contact`, `analyze-partner`, `sherlock-extract`, `parse-profile-ai`, `ai-deep-search-helper`.
- Memory: `Scrape-then-Analyze`, cache `scrape_cache` 7gg.
- Memory `no-wca-download-ai`: agenti possono proporre solo enrichment, no download WCA.

### Stato DB
| Metrica | Valore |
|---|---|
| Partner totali | 11 414 |
| Partner con `enrichment_data` non vuoto | **5** (0,04%) |
| Contatti totali | 9 236 con email |

### Problemi
- 99,96% partner senza arricchimento.
- Nessuna automazione batch enrich.
- Funzione c'è ma è solo on-demand.

### Azioni
- **P2** (futuro): job notturno autopilot enrich N partner/notte rispettando rate limit AI.

---

## 6. AUTOMATION

### Codice
- Edge: `outreach-scheduler` (FOR UPDATE SKIP LOCKED, batch 20, exp backoff), `cadence-engine`, `agent-autopilot-worker`, `agent-autonomous-cycle`, `process-email-queue`, `pending-action-executor`, `email-cron-sync`, `email-sync-worker`, `smart-scheduler`, `mission-executor`.
- DB function `acquire_outreach_batch`, `acquire_mission_slot`, `release_mission_slot`, `cron_job_status`.
- Trigger `on_ai_pending_action_approved` → invoca `pending-action-executor` su approvazione.

### Stato DB
| Tabella | Stato |
|---|---|
| `outreach_queue` | 0 righe |
| `outreach_schedules` | non interrogabile da user (RLS) |
| `email_campaign_queue` | 4 righe (2 sent / 2 failed) |
| `campaign_jobs` | 0 |
| `agent_tasks` | **1539 pending**, 36 proposed, 1 completed |
| `agents` | 23 (13 attivi, **massiccia duplicazione**) |
| `app_settings` (cron-rilevanti) | `ai_automations_paused=false`, `agent_max_actions_per_cycle=10`, finestra 7→23 |

### Duplicati agents (da deduplicare in P0.3)
| Nome | Attivi | Inattivi | Totale |
|---|---|---|---|
| Luca | 1 | 3 | 4 |
| Luca — Director | 1 | 1 | 2 |
| Marco | 2 | 3 | 5 |
| Robin | 1 | 1 | 2 |
| Sara | 1 | 1 | 2 |
| Bruce, Carlo, felice, gianfranco, gigi, imane, Leonardo, marco, Renato | 1 | 0 | 9 |

Marco ha 2 record `is_active=true` con stesso nome → ambiguo per il routing.

### Problemi
- **1539 agent_tasks pending mai consumati** → l'autopilot accoda ma nessuno esegue.
- Cron non interrogabile come user normale (`permission denied for schema cron`); abbiamo però `cron_job_status()` SECURITY DEFINER → possiamo usarla per diagnosticare in P1.2.
- Outreach queue vuota → scheduler gira a vuoto.

### Azioni
- **P0.3**: dedup agents (is_active=false + suffisso `[DUP]`).
- **P1.2**: report diagnostico autopilot (cron_job_status, breakdown task per agent_id, finestre orarie).

---

## 7. Roadmap P0/P1 (ordine di esecuzione)

| Step | Cosa | Bloccante per |
|---|---|---|
| **P0.1** | Tabella `email_send_log` + retrofit `send-email` + `process-email-queue` | Dashboard email, audit |
| **P0.2** | Insert default WA/LI in `app_settings` | Pannello timing operativo |
| **P0.3** | Dedup agents (is_active=false + `[DUP]`) | Routing per nome |
| **P1.1** | Fix query `operative_prompts.scope` → `.context` | Lab agente |
| **P1.2** | Report diagnostico 1539 task pending | Capire blocco autopilot |
| **P1.3** | Seed 3 `email_prompts` globali | Composer email |

### Vincoli architetturali da rispettare
- `mem://constraints/no-physical-delete`: mai DELETE su record business → trigger DB lo intercetta. Tutte le dedup via `is_active=false`.
- `mem://auth/working-auth-config-2026-04-15`: non toccare auth.
- `mem://auth/whitelist-email-auth-standard`: solo email+password con whitelist.
- DAL pattern: nessuna query Supabase fuori da `src/data/` o `src/v2/io/supabase/`.
- Edge function: CORS dinamico via `getCorsHeaders`, validazione Zod, JWT in code (`verify_jwt = false` in config.toml).
- RLS obbligatoria su ogni nuova tabella; policy `user_id = auth.uid()`.
- Fire-and-forget: insert log non deve mai bloccare l'invio.

### Decisioni di design
- `email_send_log` separata da `email_campaign_queue`: la prima è audit append-only, la seconda è coda di processamento. Coesistono, niente migrazione.
- `send_method` enum letterale (`direct|queue|campaign|agent`) per filtrare per origine.
- Indici: `(user_id, sent_at DESC)` per timeline utente, `(status) WHERE status != 'sent'` per dashboard errori (parziale, leggero).

