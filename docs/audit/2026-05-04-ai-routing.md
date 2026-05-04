# Audit AI, Routing & Scheduling — 4 maggio 2026

> Fotografia dello stato del sistema commerciale autonomo: classificazione email, routing post-classificazione, generazione contenuti, esecuzione/approvazione e i quattro motori di scheduling. Nessuna modifica fatta — solo diagnosi.

---

## 0. TL;DR

Il sistema **è progettato bene** (process manager, gate sui rischi, prompt versionati, journalist review obbligatorio sui canali in uscita), **ma due tubi sono otturati** e una manciata di handler non è cablata in modo coerente. In numeri:

| KPI | Valore | Atteso | Esito |
|---|---|---|---|
| Email inbound ultimi 30gg | **7.882** | — | OK ingestione |
| Righe in `email_classifications` | **1** (totale storico, 13/04) | ≥ migliaia | **🔴 P0 — pipeline classificazione muta** |
| Righe in `funnemail_decisions` | **0** | tutte | **🔴 P0 — Funnemail mai chiamato** |
| `ai_pending_actions` aperte | 0 (1 approved storica) | decine attese | 🔴 conseguenza dei P0 |
| Cron attivi | 19 | — | OK |
| Edge function | 113 | — | OK |
| Agent tasks completed | 2.116 | — | OK il loop autopilota |

Una volta tappati i due P0, il resto dei problemi è di qualità (handler mancanti, draft non passati da journalist, scheduler che possono produrre azioni doppie).

---

## 1. Mappa del flusso "email entra → cosa succede"

```
                        ┌──────────────┐
   IMAP (cron 15')──▶   │ check-inbox  │  scrive channel_messages
                        └──────┬───────┘
                               │ fire-and-forget (max 10/ciclo)
                  ┌────────────┴───────────────┐
                  ▼                            ▼
       apply-email-rules            classify-email-response
        (regole address)            (commerciale, 9 stati)
                                        │
                                        ├─▶ email_classifications  ◀─ 🔴 0 righe
                                        ├─▶ applyLeadStatusChange  (guard SSOT)
                                        ├─▶ EmailProcessManager.processClassification
                                        │       └─▶ postClassificationPipeline
                                        │              ├─ emailRouter (commercial)
                                        │              ├─ domainHandler (op/admin/sup/int)
                                        │              ├─ bounce/unsub
                                        │              └─ question/complaint/OOO
                                        │                     │
                                        │                     ▼
                                        │            ai_pending_actions + activities (reminder)
                                        │                     │
                                        │           pending-action-executor (status='approved')
                                        │                     │
                                        │           send-email/-whatsapp/-linkedin
                                        │                     │
                                        │           postSendPipeline → reminderManager (sequenza 0/3/7/8/12/16/23)
                                        │
                                        ▼
                              (mai eseguito) funnemail-classify
                              (smistamento cartelle UI)
```

### Le altre due classificatrici parallele
- `classify-inbound-message` — variante multicanale (email/WA/LI), invoca anche `funnemail-classify`. **Non risulta chiamata** da `check-inbox`.
- `reply-classifier` — classificatore minimale (positive/negative/needs_human/spam) invocato da trigger `on_inbound_message_received` via `pg_net`. Esiste, non sappiamo se il trigger è attivo (vedi P0-3).

**Tre classificatori coesistono ma `check-inbox` ne chiama solo uno** (`classify-email-response`) — e solo per i primi 10 messaggi del ciclo.

---

## 2. Problemi P0 (bloccanti)

### P0-1 — `classifyInboundEmails` non parte mai
**File:** `supabase/functions/check-inbox/postProcessing.ts:64`

```ts
const toClassify = messages
  .filter((m) => (m.raw_payload as Record<string, unknown>)?.direction === "inbound")
  .slice(0, 10);
```

Filtra per `raw_payload.direction === "inbound"`. **Ma `raw_payload` reale contiene solo `{ uid, date, sender_name }`** — vedi `check-inbox/dbOperations.ts:203`:

```ts
raw_payload: { uid: params.uid, date: params.date, sender_name: params.match.name || params.senderName }
```

`direction` è una colonna a sé, non è dentro `raw_payload`. Risultato: il filtro restituisce sempre `[]`, **nessuna classificazione viene mai schedulata**. Coerente con `email_classifications` = 1 riga (quella di test del 13/04 quando il filtro funzionava o era diverso).

**Fix one-liner:** `.filter(m => true)` o usare la colonna corretta. Da fare con cautela perché il file è in lista `DO NOT MODIFY` — serve autorizzazione esplicita.

### P0-2 — Funnemail Classifier mai invocato sull'inbox
- Cartelle `funnemail_folders`: 14 attive ✅
- Prompt operativo `funnemail_classifier`: **0 righe** in `operative_prompts` (la query mostra `count` mancante per quel context — il loader cade silenziosamente sul fallback).
- Tabella `funnemail_decisions`: **0 righe**.
- `funnemail-classify` viene invocato solo da `classify-inbound-message` e dall'hook `useFunnemailInbox` (UI). Nessun trigger automatico sull'arrivo di una email.

L'utente vede l'inbox ma **nulla è smistato nelle cartelle** "RFQ / supporto / interna / da smistare". Tutto resta in `to_sort` (di fatto: invisibile per categorizzazione UI).

### P0-3 — Tre classificatori sovrapposti, nessuna SSOT
| Classificatore | Cosa scrive | Chi lo chiama |
|---|---|---|
| `classify-email-response` | `email_classifications` + lead_status + post-pipeline | `check-inbox` (broken) |
| `classify-inbound-message` | `inbound_classifications` (?) + funnemail | trigger `on_inbound_message_received`? UI? |
| `reply-classifier` | `reply_classifications` | trigger DB pg_net |
| `funnemail-classify` | `funnemail_decisions` | `classify-inbound-message`, UI |

Un'email che entrasse davvero verrebbe classificata da 1, 2 o 3 sistemi diversi — con esiti potenzialmente in conflitto. **Serve una SSOT** (proposta: `classify-inbound-message` come orchestratore unico che internamente invoca commerciale + funnemail).

---

## 3. Problemi P1 (qualità)

### P1-1 — Categorie senza handler
`postClassificationPipeline.ts` mappa esplicitamente: `interested`, `meeting_request`, `not_interested`, `auto_reply`, `bounce`, `unsubscribe`, `question`, `request_info`, `complaint`, `follow_up`. **Cadono in `skip_no_action`**: `spam`, `uncategorized`. **Mancano del tutto** dalla switch (ma sono dichiarate nel tipo): `quote_request`, `booking_request`, `rate_inquiry`, `shipment_tracking`, `cargo_status`, `documentation_request`, `invoice_query`, `payment_request`, `payment_confirmation`, `credit_note`, `account_statement`, `service_inquiry`, `technical_issue`, `feedback`, `newsletter`, `system_notification`, `internal_communication`.

→ La classificazione le riconosce, il prompt le include, ma nel router commerciale **non succede nulla**. Per l'utente: "ci chiedono un preventivo" non genera né draft né agenda.

→ Il path "domain != commercial" (operative/administrative/support/internal) gestisce le 17 categorie operative, **ma solo se il classifier mette `domain` ≠ `commercial`**. Va verificato che l'AI lo faccia.

### P1-2 — `generateReplyDraft` bypassa il journalist review
**File:** `supabase/functions/_shared/classificationRules.ts:107`

```ts
const result = await aiChat({ ... });
// nessun journalistReview() prima di salvare draft_subject/draft_body
await supabase.from("ai_pending_actions").update({ action_payload: { ..., draft_subject, draft_body }})
```

La memoria progetto è esplicita: **"Editorial review (`journalistReview`) OBBLIGATORIO e INTOCCABILE su ogni email/WA/LI prodotti o inviati. Mai bypassarlo né duplicarlo."**

Inoltre c'è un bug funzionale: l'`update` passa una **funzione** come valore di `action_payload` invece di chiamarla. Il `update` quasi certamente fallisce o salva una stringa serializzata della funzione. Da verificare con un test.

### P1-3 — Draft non review = email pre-cotta che l'operatore approva alla cieca
Conseguenza diretta di P1-2: quando arriverà la prima email "interested", l'operatore vedrà un draft generato, premerà Approva, e `pending-action-executor` invierà testo non revisionato.

### P1-4 — Routing rules persona-aware bypassano l'escalation hardcoded
In `classify-email-response/index.ts:297` la routing rule sovrascrive il `getNextStatusGated`. Se una rule dell'utente è mal scritta, può saltare lo stato. **Manca un test di regressione** sui prompt routing in `prompt_test_cases`.

### P1-5 — `funnemail-classify` ha `LOVABLE_API_KEY` opzionale, non obbligatoria
Senza chiave, ritorna `fallback({reasoning: "AI gateway 429"})` ma scrive comunque `funnemail_decisions`. Ottimo per resilienza ma **silenzioso**: nessun alert, nessuna coda. Va loggato in `edge_metrics` con flag `degraded=true`.

---

## 4. I 4 motori di scheduling — chi fa cosa, dove, quando

> "Quale è lo strumento per capire dove e se programmare un'attività futura?"

| # | Motore | Cron | Tabella scritta | Sorgente decisione | Visibile in UI |
|---|---|---|---|---|---|
| 1 | **`outreach-scheduler`** | ogni 5' | `outreach_schedules` | acquisita via `acquire_outreach_batch` (FOR UPDATE SKIP LOCKED, batch 20) | Outreach Pipeline / Kanban |
| 2 | **`cadence-engine`** | ogni ora | `mission_actions` (status `pending`/`executed`) | `cadence_rule.sequence` per missione | Mission Builder |
| 3 | **`smart-scheduler`** | giornaliero 5:00 | `ai_pending_actions` (action_type `auto_schedule_outreach`) | stale > 14gg o hot lead score ≥ 50, finestra Mar-Gio 9:00 | Decision Dashboard |
| 4 | **`agent-autonomous-cycle`** | ogni 10' | `agent_tasks` + `activities` (follow_up) | screening inbound + overdue + transizioni stato + sequenza primo touch | Staff Direzionale + Agenda |
| (lib) | **`reminderManager`** | n/a | `activities` (sequenza canonica 0/3/7/8/12/16/23) | invocato da `postSendPipeline` dopo ogni send | Agenda |
| (lib) | **`cadenceEngine.ts`** | n/a | nessuna (regole pure) | guard runtime: canale ammesso? min days? max/week? | n/a — blocca a monte |

### Conflitti & duplicati osservabili
- Una stessa "next action" può finire **sia in `mission_actions`** (cadence-engine) **sia in `activities`** (reminderManager) **sia in `ai_pending_actions`** (smart-scheduler) **sia in `agent_tasks`** (autonomous-cycle). Nessun deduper trasversale.
- L'agenda (`Agenda Action Grouping`) legge `activities` con grouping per tipo. **Non vede** `mission_actions` e `outreach_schedules`. → l'utente non sa che ci sono altre azioni in coda.
- `agent-autonomous-cycle` Phase 2 controlla `agent_tasks.target_filters.activity_id` per dedup overdue → **funziona solo all'interno del proprio motore**, non cross-motore.

### Quando viene "programmata un'attività futura"
Tre trigger principali:
1. **Dopo un send** → `postSendPipeline` → `reminderManager.createReminder` → `activities` con sequenza giorni (canonica per primo contatto, generica T+days altrimenti).
2. **Dopo una classificazione `interested`/`meeting_request`** → `emailRouter.handleInterested` → `activities` T+1 (meeting) o T+2 (interested) + `ai_pending_actions`.
3. **Daily cron** → `smart-scheduler` propone sui contatti stale.

Domande aperte per l'operatore:
- "Devo cercarla in Agenda o in Outreach Pipeline?" → entrambi. Va unificato.
- Quando un contatto è in stato `holding`, `cadenceEngine` blocca tutti i canali con `minDaysBetweenContacts: 14` — ma `reminderManager` continua a creare reminder T+5/T+7. **Blocco di scrittura ≠ blocco di reminder** → operatore vede follow-up che NON può eseguire.

---

## 5. Esecuzione & approvazione

`pending-action-executor` ✅ rispetta:
- status='approved' obbligatorio
- pause globale `ai_automations_paused`
- audit `supervisor_audit_log`
- refresh contesto pre-execute (rule, lead_status)

Punti deboli:
- Non chiama `aiActionRiskGate` esplicitamente — confida che l'inserimento di `ai_pending_actions` sia già passato dal gate. **Verificare** che TUTTI gli insert (compresi quelli di `emailRouter`/`smartScheduler`) lo facciano.
- Action types gestiti: `send_email`, `send_proposal`, `send_whatsapp`, `send_linkedin`, `schedule_followup`, `create_reminder`, `update_lead_status`. **Non gestiti**: `reply_to_question`, `handle_complaint`, `send_graceful_close`, `schedule_meeting`, `forward_to_operative`, `review_not_interested` — alcuni di questi **vengono creati** dai router ma il loro action_type non è in switch dell'executor → cadono in default (`unknown action_type`).

---

## 6. Holding pattern & lead status

✅ Il guard SSOT `applyLeadStatusChange` è correttamente importato in 12 punti (autonomous-cycle, classify-email-response, emailRouter, leadProcessManager, pending-action-executor, agent-execute, ecc.).
✅ I 9 stati canonici sono codificati in `cadenceEngine.ts`.
⚠️ Trigger di uscita da `holding` è solo `engaged` via classificazione `interested` (in `emailRouter.handleInterested`). **Se classificatore è muto (P0-1) → nessun lead esce mai da holding automaticamente.** Combinato con lo smart-scheduler che propone follow-up a 14gg: i lead ciclano in `holding` per sempre.

---

## 7. Sicurezza & guardrail

✅ **Ben coperti**: `promptSanitizer`, `injectionGuard`, `contentNormalizer`, `aiInvocationGuard` (Charter), `ai_action_risk` 7 livelli + two-phase commit.
✅ Soft-delete globale via trigger.
✅ CORS whitelist.
✅ Hard guards no-DELETE, bulk cap.
⚠️ `journalistReview` **manca in `generate-outreach`, `pending-action-executor`, `agent-loop`**. Presente in `generate-email`, `improve-email`, `send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue`, `agent-execute/emailTools`. **Coperto al send** in modo difensivo, ma generato senza review nell'`emailRouter` draft (P1-2).

---

## 8. Osservabilità

✅ `ai_interaction_log` (gateway) + `ai_message_feedback` + pagina `/v2/ai-interactions-log`.
✅ `supervisor_audit_log` (azioni AI/system).
✅ `edge_metrics` + `cron_run_log`.
✅ `email_send_log` (deduplicato per `message_id`).
❌ **Manca un dashboard "Cosa ha fatto l'AI ieri"** che unifichi: classificazioni, transizioni stato, pending actions create, reminder generati, send eseguiti — con drill-down per origine (auto vs approvata).

---

## 9. Quick wins (≤30 minuti)

1. **Fix P0-1**: cambiare il filtro in `postProcessing.ts:64` per usare la colonna `direction` o non filtrare. Vincolato a sblocco "DO NOT MODIFY".
2. **Fix P1-2**: in `classificationRules.ts:127`, sostituire la funzione passata come `action_payload` con un oggetto risolto (rileggere row, fare merge, update), e inserire `journalistReview()` prima dell'update.
3. **Aggiungere `funnemail_classifier` al Prompt Lab** (1 riga in `operative_prompts`).
4. **Cablare `funnemail-classify` in `check-inbox`** in parallelo alla classify commerciale (Promise.allSettled).
5. **Estendere switch executor** con `reply_to_question`, `handle_complaint`, `send_graceful_close`, `schedule_meeting` (mappati a `send_email` con template diverso).

## 10. Interventi strutturali (≥1 giornata)

A. **Unificare i tre classificatori** dietro `classify-inbound-message` come SSOT, che internamente invoca:
   1. `funnemail-classify` (smistamento UI),
   2. `classify-email-response` (commerciale, lead_status),
   3. `reply-classifier` (intent semplice, retro-compat).
   Output unico in `inbound_classifications` con vista materializzata sulle altre tabelle.

B. **Vista unica "Prossima azione"** che unifica `activities` + `mission_actions` + `outreach_schedules` + `ai_pending_actions`, con dedup per `(partner_id, scheduled_date, channel, action_type)`.

C. **Coverage matrix per categorie**: per ognuna delle 30 categorie del tipo `ClassificationCategory`, esplicitare in DB (`category_handler_map`) quale handler la gestisce, quale draft type genera, se va in agenda, se richiede approvazione. Editabile da Prompt Lab.

D. **Guardia di "azioni proposte da scheduler ≠ canale ammesso da cadenza"**: prima che `smartScheduler`/`autonomous-cycle` creino una pending action, far passare per `cadenceEngine.checkCadence`. Eviterà reminder che l'operatore non può eseguire.

E. **Dashboard giornaliero "AI Diary"**: mappa visuale del giorno con filtri origine/azione/risultato.

---

## 11. Raccomandazioni vincolanti (memoria)

1. **Mai più filtri su `raw_payload.direction`**: usare colonna `direction`. Aggiungere lint.
2. **Ogni nuovo `aiChat` che produce testo destinato a comunicazione esterna DEVE passare da `journalistReview()` prima del salvataggio**, non solo prima del send. (Estensione della memoria esistente.)
3. **Ogni motore di scheduling che inserisce in `activities`/`ai_pending_actions`/`agent_tasks` DEVE prima passare per `cadenceEngine.checkCadence()`** col canale e lo stato attuali.
4. **Coverage test obbligatorio**: per ogni `ClassificationCategory` esistere almeno un test in `prompt_test_cases` che verifica la presenza di un handler corrispondente.

---

*Generato il 2026-05-04 da audit automatico, query DB live + lettura mirata 18 file edge function. Nessuna modifica applicata.*
