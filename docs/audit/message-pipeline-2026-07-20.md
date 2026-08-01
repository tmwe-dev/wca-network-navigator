# Message Pipeline — Baseline B0 (2026-07-20)

Mappa end-to-end della pipeline messaggi al momento dell'apertura del piano
P0 di consolidamento. Basata sul **codice reale**, non sulla documentazione
preesistente. Le divergenze rispetto a `mem/` sono segnalate esplicitamente.

## 1. Ingestione

| Sorgente | Edge function | Persistenza |
|---|---|---|
| IMAP (personal + shared mailbox) | `check-inbox` | `channel_messages` (direction=inbound) |
| Cron IMAP | `email-cron-sync` → `check-inbox` | idem |
| Sent items | `email-sync-worker` | `channel_messages` (direction=outbound) |
| WhatsApp / LinkedIn extensions | `receive-channel-message` | `channel_messages` |

## 2. Trigger di classificazione (3 percorsi paralleli)

```text
                           ┌────────────────────────────┐
  INSERT channel_messages ─┤ trigger on_inbound_message │─→ pg_net.http_post(classify-inbound-message)
                           └────────────────────────────┘

  check-inbox (fine batch) ──────────────→ fetch(classify-inbound-message)  [max 10, per sync]

  cron 5 min ────────── classify-emails-batch ────────→ classify-inbound-message  [safety net]
```

Dedup: `classify-inbound-message` guarda `reply_classifications.message_id`
e ritorna `{ deduped: true }` se già presente.

## 3. Orchestratore `classify-inbound-message`

```text
  received → (guard injection) → stage1 AI → stage2 Post → stage3 Funnemail → stage4 Content
```

| Stage | Scrittura | Fire-and-forget |
|---|---|---|
| stage1 AI | `reply_classifications`, `activities`, `ai_pending_actions` | no |
| stage2 Post | `email_classifications` (via EmailProcessManager), `funnemail_actions_log` | no |
| stage3 Funnemail | `funnemail_scout_cache`, `funnemail_message_status`, `email_address_rules`, `funnemail_actions_log` | sì |
| stage4 Content | `email_content_intelligence`, `contact_conversation_context`, `alert_dispatch_log` | sì |

## 4. Duplicazioni note (candidate B1–B5)

- D1 — tre trigger paralleli.
- D2 — `reply_classifications` vs `email_classifications`.
- D3 — `classify-email-response` orfano (zero caller runtime, deploy on).
- D4 — 3-4 tabelle "routing/azione" (`funnemail_actions_log`,
  `inbound_operative_actions`, `ai_pending_actions`, `email_address_rules`).
- D5 — filtri newsletter duplicati (trigger SQL vs `email_address_rules`).
- D6 — body extraction doppia (`check-inbox/bodyExtractor` vs `email-imap-proxy`).
- D7 — prompt classificazione duplicati.

## 5. Contratto canonico proposto

`src/v2/core/domain/messageIntelligence.ts` — `MessageIntelligenceResult`.

Produttore unico: `classify-inbound-message`. Tabella canonica: estensione
additiva di `reply_classifications` (B1). Vista di lettura per consumer:
`public.message_intelligence_v` (B3).

## 6. Osservabilità B0

- Nuovo step tracer `classify_inbound:dedup_hit` (in orchestratore, ramo
  dedup) con `payload_summary.source_hint`.
- Header `x-invoke-source` su 2 caller:
  - `inboxPostProcess.ts` → `check-inbox-postProcess`
  - `classify-emails-batch/index.ts` → `cron-batch`
  - trigger DB → nessun header (misurato per differenza come `unknown`).
- Report: `deno run -A scripts/report-classify-dedup.ts`.

## 7. Gate per B2 (rimozione fallback postProcess)

Rimozione autorizzata quando lo script mostra:
- `check-inbox-postProcess` con `dedup_hits / invocations` ≥ 60% per 7 gg;
- `unknown` (trigger DB) copre ≥ 95% dei `unique_messages` totali;
- `cron-batch` resta come safety net (< 5% del volume).

## 8. Vincoli invariati

`check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview` non
toccati in nessun batch di questo piano.