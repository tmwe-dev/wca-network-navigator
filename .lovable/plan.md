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
**Diagnosi reale (verificata 11/05):** non ci sono duplicati esatti `(user_id, name, context)`. Il problema sono **nomi diversi attivi sullo stesso scope** per lo stesso utente — comportamento non deterministico.

### 1.1 ✅ FATTO — `funnemail_classifier` deduplicato
Tutti i 6 utenti hanno ora **1 sola versione attiva**: "Funnemail Classifier v1". Le 2 varianti ("Funnemail Classifier", "Funnemail classifier — capire prima di agire") sono state marcate `is_active=false` + tag `deprecated_2026_05_11`. Reversibile.

### 1.2 ✅ FATTO — Verifica scope concorrenti
Analisi del contenuto dei prompt su `classification`, `email`, `email-quality`, `outreach`: confermati come **layer compositivi legittimi** (ogni prompt copre un ruolo distinto: classifier vs router vs triage vs system base; outbound vs reply vs style; ecc.). **Nessun ulteriore intervento richiesto.**

### 1.3 Guard anti-regressione (dopo 1.2)
- ✅ FATTO — UNIQUE INDEX parziale `operative_prompts_active_unique_idx (user_id, context, name) WHERE is_active = true` attivo. I prossimi seed che provassero a re-inserire un duplicato esatto fallirebbero con violazione di vincolo.
- ⏳ Tabella `operative_prompts_scope_policy(context, mode)` + trigger single-winner: rinviato (non serve subito, oggi `funnemail_classifier` è già pulito).

### 1.4 Test regressione
- `prompt_test_cases` ha già 17 righe (audit aggiornato). Verificare copertura su Funnemail Classifier v1 nei prossimi sprint.

**Definition of Done:** scope policy esplicita in DB; trigger guard attivo; ≥5 test_cases verdi.

---

## Sprint 2 — Accendere Funnemail in produzione (3 → 9/10)
**Obiettivo:** dispatcher attivo su gruppi pilota con policy reali.

1. ✅ FATTO — `Amministrativo` + `FORNITORI` abilitati con policy `{tag_only, crm_update}`, min_confidence 0.6, pilot=true, no draft_reply, no autoresponder. Reversibile.
2. ✅ Già live — `classify-inbound-message` chiama `dispatchFunnemail` post-classificazione → ogni nuovo inbound dei 2 gruppi pilota attiverà Funnemail in tempo reale.
3. ⏳ Backfill 7gg storico (52 inbound) — fare DOPO la finestra di osservazione 48h.
4. ⏳ Verifica a 48h: `funnemail_actions_log` + `funnemail_decisions` ≥80% sui gruppi pilota → poi allargare.
5. ⏳ Cron retry per messaggi falliti — dipende da volume DLQ osservato.

**Definition of Done:** ≥80% degli inbound nei gruppi pilota ha `funnemail_decisions` + `funnemail_actions_log` entro 48h.

---

## Sprint 3 — Telemetria AI completa (4 → 10/10)
**Obiettivo:** ogni invocazione AI tracciata, nessuna eccezione.

1. ✅ FATTO — CHECK constraint `ai_interaction_log.interaction_type` esteso con `'edge_ai'` + DAL TS aggiornato + UI `/v2/ai-interactions-log` riconosce il nuovo tipo (label "Edge AI" + icona Cpu).
2. ⏳ Wrapper `_shared/aiInvocationLogger.ts` per popolare il log dalle edge.
3. ⏳ Migrazione 8 edge function loader-aware al wrapper.
4. ⏳ Filtri UI per `function_name` / `scope` / tokens.
5. ⏳ Alert Discord soglia minima.

**Definition of Done:** `ai_interaction_log` riceve >100 righe/giorno con `interaction_type='edge_ai'`; copertura ≥95% delle invocazioni AI tracciate.

---

## Sprint 4 — Routing & Personas (4 → 9/10)
**Obiettivo:** popolare i layer dichiarati ma vuoti.

**Stato 11/05 (verificato):** `agent_personas` 8 righe ✅, `agent_capabilities` 45 righe ✅, `prompt_test_cases` 17 righe ✅. **`agent_routing_rules` ancora vuota** ❌.

1. ⏳ Seed `agent_routing_rules`: matrice (domain × category × sentiment) → agent_id. Richiede mappatura agent specifici × scenari → input utente.
2. ⏳ Smoke test Prompt Lab Simulator per i 5 agenti core.
3. ⏳ Risolvere 6 finding del deep audit 04/05.

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