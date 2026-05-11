## Obiettivo
Portare Funnemail + governance prompt + smistamento job da 5.5/10 a 10/10, in 5 sprint atomici e verificabili. Ogni sprint chiude con metriche misurabili e test di regressione.

## Stato attuale (audit 11/05)
- Architettura 8/10 — buona, ma non eseguita
- Runtime 3/10 — 0 gruppi `funnemail_enabled`, 0 policy override, 0 suggerimenti AI salvati su 52 inbound
- Prompt 2/10 — 36 prompt con 5–6× duplicati, 3 versioni concorrenti su `funnemail_classifier`
- Telemetria 4/10 — `ai_interaction_log` chat-only, edge AI non loggati
- KB & dispatching 4/10 — `agent_personas`/`agent_routing_rules` vuote, nessun cron su policy-engine

---

## Sprint 1 — Pulizia prompt (2 → 9/10)
**Obiettivo:** 1 sola versione canonica per ogni `(name, context)`.

1. Script `scripts/dedup-operative-prompts.ts`: per ogni `(user_id, name, context)` mantiene la riga con `priority` più alta + `updated_at` più recente; le altre → `is_active=false` + tag `deprecated_2026_05_11`.
2. Caso speciale `funnemail_classifier`: scelta manuale della versione vincente (2925 char) → unica `is_active=true`, le altre archiviate.
3. Fix del seed che continua a creare duplicati: aggiungere check `findOperativePromptByNameContext` prima dell'insert + UNIQUE INDEX parziale `(user_id, name, context) WHERE is_active`.
4. Test: `prompt_test_runner` su 5 prompt critici (Funnemail Classifier, Reply Writer, Quality Gate, Content Intelligence, Inbound System) → tutti verdi.

**Definition of Done:** `SELECT name, context, count(*) FROM operative_prompts WHERE is_active GROUP BY 1,2 HAVING count(*)>1` ritorna 0 righe.

---

## Sprint 2 — Accendere Funnemail in produzione (3 → 9/10)
**Obiettivo:** dispatcher attivo su gruppi pilota con policy reali.

1. Pilot su 2 gruppi: `amministrazione` + `support_provider`. Set `funnemail_enabled=true` + 1 policy minimale (tag_only + crm_update).
2. Verifica end-to-end: trigger 3 email reali per gruppo → controlla `funnemail_actions_log` e `funnemail_decisions` popolati.
3. Schedulare `funnemail-policy-engine` via pg_cron ogni 5 min sui messaggi non ancora processati (oggi gira solo on-demand).
4. Backfill `ai_classification_suggestion` sugli ultimi 7 giorni di inbound (52 messaggi) per popolare la tab Suggerimenti AI.
5. Rollout graduale: dopo 48h senza errori → abilitare 5 gruppi commerciali.

**Definition of Done:** ≥80% degli inbound nei gruppi pilota ha `funnemail_decisions` + `ai_classification_suggestion`.

---

## Sprint 3 — Telemetria AI completa (4 → 10/10)
**Obiettivo:** ogni invocazione AI tracciata, nessuna eccezione.

1. Estendere CHECK constraint su `ai_interaction_log.interaction_type` con `'edge_ai'`.
2. Wrapper `_shared/aiInvocationLogger.ts`: `logEdgeAi({function_name, scope, model, tokens, duration})` chiamato da `invokeAi()`.
3. Migrare le 8 edge function loader-aware (generate-email, generate-outreach, classify-inbound-message, ecc.) a usare il logger.
4. Dashboard `/v2/ai-interactions-log` esteso: filtro per `function_name`, `scope`, costo/tokens.
5. Alert Discord se `edge_ai` invocations < 10/h durante orario lavorativo.

**Definition of Done:** `ai_interaction_log` riceve >100 righe/giorno con `interaction_type='edge_ai'`; copertura ≥95% delle invocazioni AI tracciate.

---

## Sprint 4 — Routing & Personas (4 → 9/10)
**Obiettivo:** popolare i layer dichiarati ma vuoti.

1. Seed `agent_personas` per i 5 agenti core (Luca, Funnemail, Sherlock, Gordon, Sara) con identità + tono + KB filter.
2. Seed `agent_routing_rules`: matrice `(intent, scope, channel) → agent_id` con almeno 12 righe coprenti i casi reali.
3. Verificare `agent_capabilities` per i 3 agenti con 0 tool (Funnemail, Gordon, Sara) → assegnare tool whitelist coerente.
4. Smoke test in Prompt Lab Simulator per ogni agente: input campione → output atteso (no allucinazioni, tool corretti).
5. Risolvere i 6 finding aperti del deep audit 04/05: `pending-action-executor` handler `reply_to_question`/`handle_complaint`, dedup cross-engine scheduling, ordine cron `memory-promoter` vs `memory_embed_backfill`.

**Definition of Done:** 0 agenti con personas/routing/capabilities mancanti; deep audit 04/05 chiuso.

---

## Sprint 5 — Governance & test di regressione (qualunque → 10/10)
**Obiettivo:** impedire regressioni future.

1. Implementare la **Prompt Governance Doctrine** già definita in `docs/adr/0004`: edge `prompt-change-kernel` come unico punto di scrittura; UI Prompt Lab → solo `change_request`.
2. Rubric Engine deterministico: 2-3 rubriche bloccanti per agente (length, JSON schema, presenza tag obbligatori).
3. Coverage Matrix `(agent × scope × KB × golden_input × rubric)` come tabella DB + dashboard `/v2/governance/coverage`.
4. CI: blocca merge se `prompt_test_runner` fallisce su qualunque rubrica bloccante.
5. KB Health Dashboard: stale entries, duplicati, copertura embedding.

**Definition of Done:** nessuna scrittura diretta su `operative_prompts` fuori dal kernel; Coverage Matrix ≥90%; CI bloccante attiva.

---

## Scorecard target post-piano
| Area | Oggi | Target |
|---|---|---|
| Architettura | 8 | 10 |
| Runtime | 3 | 10 |
| Prompt | 2 | 10 |
| Telemetria | 4 | 10 |
| KB & dispatching | 4 | 10 |
| **Totale** | **5.5** | **10** |

## Esecuzione
- Sprint atomici: nessun sprint inizia se il precedente non ha DoD verde.
- Ogni sprint = 1 PR singola (no refactor opportunistici, regola del Metodo Enterprise Vol II).
- Rollback plan documentato per ogni sprint (snapshot `prompt_versions`, feature flag su dispatcher).

## Approvazione richiesta
Confermi di partire da **Sprint 1 (pulizia prompt)**? È quello a leverage più alto e sblocca la qualità dei successivi.