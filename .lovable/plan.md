
# Audit reale (11 maggio 2026, dati DB live)

## 🔴 P0 — pipeline inbound clinicamente morta
| Metrica 30gg | Atteso | Reale |
|---|---:|---:|
| Email inbound (`channel_messages` email) | 6.679 | **6.679** ✅ |
| `email_classifications` (classify-email-response) | ~6.000 | **1** 💀 |
| `ai_classification_suggestion` su inbound | ~6.000 | **0** 💀 |
| `funnemail_decisions` | ~6.000 | 39 |
| `funnemail_actions_log` (esecutore) | ~6.000 | **1** 💀 |
| `funnemail_policy` | >0 | **0** |
| `funnemail_message_status` | — | 30 (manuali) |

→ L'imbuto Funnemail oggi vive solo grazie ai claim manuali "Lo prendo io". L'AI vede 6.6k mail al mese e ne smista 1. La causa è nota dall'audit 04-05 (P0 #1 + #2): `check-inbox/postProcessing.ts` filtra `raw_payload.direction` invece del campo top-level → `postClassificationPipeline` non parte mai → niente classifier, niente Funnemail decider, niente policy executor, niente auto-route.

## 🔴 P0 — Prompt Lab senza loop vivo
- 136 `operative_prompts` attivi su **54 nomi distinti** → **82 duplicati** (6 copie per ognuno dei 16 prompt critici).
- `prompt_test_runs` ultimi 30gg: **0** → cron `prompt-test-runner` esiste ma non gira (o gira a vuoto su `prompt_test_cases`=17).
- 14 `ai_pending_actions` pendenti (incluso refiner) senza badge nel Prompt Lab.
- `agent_personas`: 8 righe ma `custom_tone_prompt` quasi vuoto (la doctrine richiede ≥300 char).
- `agent_routing_rules`: 5 righe → routing tra agenti praticamente inerte.

## 🟠 P1 — Holding Pattern senza SLA
- 101 partner in holding (`first_touch_sent | holding | engaged`).
- Nessuna metrica age/SLA visibile, nessuna sveglia automatica: `wake_up_rules` esiste ma `smart-scheduler` legge ancora costanti.
- Telemetria `ai_interaction_log`: 24 entry/7gg vs 6679 inbound → charter ENFORCED ma quasi nessuno passa dal gateway lato classifier.

---

# Principi del piano (Codex + Manuale Vol II)

1. **Zero nuove pagine.** Ogni miglioria atterra su strumenti già esistenti: `PromptLabPage`, `EmailIntelligencePage` (tab Funnemail), `FunnemailInboxPage`, `AgendaPage`, `AutomationsPanel` in top-bar.
2. **Atomicità.** Un PR = un nodo. Niente refactor opportunistici.
3. **Defense in depth.** Ogni fix ha rollback (env flag o feature toggle in `system_flags`).
4. **Misurare prima di celebrare.** Ogni step si chiude solo quando un counter DB sale.

---

# Piano in 5 sprint (in serie, atomici)

## Sprint A — Resuscitare la pipeline inbound (P0, blocco #1)
1. **Fix `check-inbox/postProcessing.ts`**: leggere `direction` top-level (e fallback `raw_payload.direction`). 1 riga di codice + test.
2. Re-deploy `check-inbox` e verificare dopo 1h: `email_classifications` sale, `ai_classification_suggestion` non più 0.
3. **Cablare `funnemail-classify`** dentro `postClassificationPipeline` (o richiamarlo dal dispatcher). Hard guard: feature flag `FUNNEMAIL_CLASSIFIER_ENABLED` in `system_flags`.
4. **Aggiungere handler mancanti** alle 16 categorie commerciali in `postClassificationPipeline` (oggi nessun handler → silent drop).
5. **KPI di chiusura**: `funnemail_decisions/30d > 5000`, `funnemail_actions_log/30d > 1000`.

## Sprint B — Funnemail policy engine operativo (P0, blocco #2)
1. Sbloccare `funnemail-policy-executor` per le action `tag_only|crm_update|snooze|escalate` (oggi 1 sola entry in 30gg → l'executor non viene mai chiamato).
2. Seedare **policy minime per gruppo** (`funnemail_policy`): newsletter→snooze, fornitori→tag_only, amministrazione→escalate L1. Niente `draft_reply` automatico (resta journalistReview).
3. Esporre l'editor policy nel **5° tab "Funnemail" già esistente** in `EmailIntelligencePage` (pannello editabile, non nuova pagina).
4. **Realtime tail azioni** già montato in `FunnemailInboxPage`: solo riallinearlo a `funnemail_actions_log` con badge per status (`ok|duplicate|error`).
5. **KPI**: ≥10 policy attive, ≥80% inbound auto-classified entro 60s.

## Sprint C — Prompt Lab vivo (P0, blocco #3)
1. **Dedup `operative_prompts`**: 136→54 via migration soft-delete (mantieni versione attiva più recente per `name`, snapshot in `prompt_versions` esiste già). Stessa SQL già delineata in `mem://standards/prompt-lab-improvement-roadmap`.
2. **Banner "Suggestions pendenti"** nel `PromptLabHealthBanner` esistente: count `ai_pending_actions(type='prompt_refinement', status='pending')` con CTA che apre `SuggestionsReviewPage` (già esiste).
3. **Attivare cron** `prompt-test-runner` su top-30 prompt usati (nightly 03:00 UTC), e `agent-prompt-refiner` settimanale (lunedì 04:00 UTC). Già pronti, basta `cron.schedule` con kill-switch.
4. **Personas seed**: popolare i 7 personas vuoti con il seed `mem://reference/personas-seed-from-radiochat` (≥300 char). CHECK constraint `length(custom_tone_prompt) >= 300` per `is_active=true`.
5. **KPI**: `prompt_test_runs/30d > 200`, dedup completato, banner reattivo.

## Sprint D — Holding Pattern con SLA visibile (P1)
1. **SLA badge** nelle card holding già renderizzate da `MailRowChrome`/`EmailCard`: aggiungere `agehours` con colore (verde <72h, giallo 72-168h, rosso >168h, ✈️ pulsante). Solo CSS + helper, zero nuova pagina.
2. **Wake-up automatico**: collegare `smart-scheduler` alla tabella `wake_up_rules` (già esistente) — sostituire le costanti in-code con lookup DB.
3. **AgendaPage**: già raggruppata per azione; aggiungere sezione "Holding scaduti" filtrata da `ageHours > sla_hours`.
4. **KPI**: 0 partner holding >14gg senza azione pianificata.

## Sprint E — Health & osservabilità (P1, ultimo)
1. **`AutomationsPanel`** (top-bar, già esiste): aggiungere 3 chip live — `inbound_classified_24h`, `funnemail_actions_24h`, `prompt_test_runs_7d`. Una riga per chip in `cronJobs.ts` DAL.
2. **Dashboard Funnemail** dentro tab già esistente `EmailIntelligenceOperationsPage`: 4 KPI card (smistati/h, accuracy, claim rate, queue depth) basate su `funnemail_actions_log` + `funnemail_message_claims`. Niente route nuova.
3. **`ai_interaction_log`**: forzare `invokeAi()` anche per `classify-inbound-message` e `funnemail-classify` (2 callsite). Charter già ENFORCED, mancano 2 wrap.

---

# Defense / Rollback per ogni sprint

| Sprint | Kill-switch | Rollback |
|---|---|---|
| A | `system_flags.inbound_pipeline_enabled` | revert 1 riga `postProcessing.ts` |
| B | `system_flags.funnemail_executor_enabled` | UPDATE `funnemail_policy` SET `enabled=false` |
| C | env `PROMPT_REFINER_CRON_ENABLED` + `cron.unschedule` | dedup è soft-delete → trigger inverso |
| D | `system_flags.wake_up_rules_enabled` | smart-scheduler torna a costanti in-code |
| E | nessuno (read-only) | rimuovere chip |

---

# Cosa NON faccio (per rispetto del Codex)
- ❌ Nessuna nuova pagina, nessuna nuova route, nessun nuovo modulo top-level.
- ❌ Nessun refactor di `journalistReview` (intoccabile per dottrina).
- ❌ Nessuna modifica a `check-inbox`/`email-imap-proxy`/`mark-imap-seen` oltre l'**unica** riga di Sprint A (filtro `direction`), che è esplicitamente la causa P0 documentata.
- ❌ Nessun cambio a `auth`, RLS, soft-delete trigger, charter AI.

---

# Output finale atteso (tra 5 sprint)

| Voce | Oggi | Target |
|---|---:|---:|
| Inbound classificate /30gg | 1 | >5.000 |
| Funnemail actions eseguite /30gg | 1 | >1.000 |
| Prompt distinti attivi | 54 (su 136 righe) | 54 (su 54 righe) |
| Prompt test runs /30gg | 0 | >200 |
| Holding >14gg senza azione | n/d | 0 |
| Voto piattaforma (4 aree) | 7.2 | 8.7 |

---

# Procedo?
Voglio partire da **Sprint A — fix di 1 riga in `check-inbox/postProcessing.ts`** che da solo riattiva l'80% della catena AI inbound. È atomico, reversibile, ad alto impatto. Confermi?
