---
name: Vincoli inviolabili del business
description: Tassonomia 9 stati lead, tabelle business protette, tabelle backend riservate, Costituzione commerciale. Letto a ogni proposta che tocca dati operativi.
tags: [harmonizer, business, constraints, doctrine]
---

# Vincoli inviolabili del business

## I 9 stati lead (tassonomia chiusa)

Valori esatti del campo `lead_status` su `imported_contacts`, `partners`, `business_cards` (sincronizzati via trigger):

| Valore DB | Significato | Ordine progressione |
|---|---|---|
| `new` | Lead appena creato, mai contattato | 0 |
| `first_touch_sent` | Inviato primo messaggio, in attesa di risposta | 1 |
| `holding` | Nessuna risposta, in circuito d'attesa con re-touch programmati | 2 |
| `engaged` | Ha risposto positivamente, conversazione attiva | 3 |
| `qualified` | Qualificato come opportunità reale | 4 |
| `negotiation` | In trattativa commerciale | 5 |
| `converted` | Cliente acquisito | 6 |
| `archived` | Chiuso pulito (no follow-up futuri ma non negativo) | terminale |
| `blacklisted` | Chiuso negativo, non ricontattare | terminale |

**Vincoli sull'Harmonizer**:
- ❌ Mai proporre nuovi stati
- ❌ Mai rinominare uno stato esistente
- ❌ Mai cambiare l'ordine di progressione
- ❌ Mai unire o splittare stati
- Se un gap richiede uno stato nuovo → `resolution_layer = code_policy`

## Tabelle business PROTETTE (mai DELETE da Harmonizer)

L'Harmonizer **non può proporre DELETE** su queste tabelle in nessun caso, neanche soft. Solo READ-ONLY note se serve segnalare anomalie:

- `contacts`, `imported_contacts`, `partner_contacts`
- `partners`
- `activities`
- `channel_messages`
- `email_drafts`, `email_sync_jobs`
- `outreach_queue`, `outreach_schedules`, `outreach_missions`, `mission_actions`
- `campaigns`, `email_campaign_queue`
- `business_cards`
- `download_jobs`
- `extension_dispatch_queue`
- `cockpit_queue`
- `agent_tasks`, `ai_pending_actions`, `ai_conversations`, `ai_memory`, `ai_work_plans`, `ai_daily_plans`

## Tabelle backend RISERVATE (mai toccare)

- Schema `auth.*` (auth.users, auth.sessions, ecc.)
- Schema `storage.*`
- Schema `realtime.*`
- Schema `vault.*`
- Schema `supabase_functions.*`
- `user_roles`, `authorized_users` (vincoli RBAC, intoccabili)

Riferimento codice: `src/v2/agent/policy/hardGuards.ts` → `FORBIDDEN_TABLES`.

## Tabelle scrivibili dall'Harmonizer

L'Harmonizer può proporre azioni eseguibili (UPDATE/INSERT/MOVE/DELETE soft) **solo** su:

- `kb_entries` ✅ (UPDATE/INSERT/MOVE/DELETE soft)
- `agents` ✅ (UPDATE/INSERT, mai DELETE)
- `agent_personas` ✅ (UPDATE/INSERT, mai DELETE)
- `operative_prompts` ✅ (UPDATE field-based)
- `email_prompts` ✅ (UPDATE field-based)
- `email_address_rules` ✅ (UPDATE field-based)
- `commercial_playbooks` ✅ (UPDATE field-based)
- `app_settings` ✅ (UPDATE/INSERT key/value)

Tutto il resto → `target_type = readonly_note` con `resolution_layer = code_policy`.

## Costituzione commerciale in 10 punti

Regole di livello 2 (KB doctrine), modificabili solo con evidenza esplicita dalla libreria desiderata.

1. **Same-Location Guard**: un lead ha un unico agente assegnato con responsabilità continuativa. Mai più agenti sullo stesso lead.
2. **Approval-first**: nessun invio (email/WA/LI) senza approvazione operatore. Hard guard nel codice.
3. **Visibilità condivisa**: tutti i contatti sono visibili a tutti gli operatori autenticati. Nessun "mio cliente".
4. **Holding pattern automatico**: lead non rispondenti vanno a `holding` automaticamente, con re-touch a cadenze definite, mai forzati a `blacklisted` senza intervento operatore.
5. **No bulk silent**: bulk operation oltre `DEFAULT_BULK_CAP=5` richiede conferma esplicita; oltre `MAX_BULK_CAP_HARD=100` impossibile.
6. **Cap costi giornalieri**: rate limit 60 req/min per utente, budget token giornalieri (vedi `mem://tech/cost-control-guardrails`).
7. **Email integrity**: il codice di sync IMAP/SMTP è intoccabile da AI (vedi `mem://constraints/email-download-integrity`).
8. **Compliance GDPR**: nessuna comunicazione senza opt-in implicito (relazione esistente nelle reti WCA) o esplicito (form firmato).
9. **Lead lifecycle progressivo**: lo stato avanza solo monotonamente lungo la pipeline (eccetto archived/blacklisted). Trigger DB lo impone.
10. **Doppia conferma high impact**: proposte con `impact_score >= 7` richiedono conferma operatore esplicita prima di esecuzione (cablato in UI review).

**Se un gap proposto contraddice uno di questi 10 punti** → la proposta va rigettata o trasformata in `readonly_note`.