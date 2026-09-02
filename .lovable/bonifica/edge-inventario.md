# Bonifica — Lotto 5: inventario Edge Functions (Lente 1 + Lente 2)

Data: 2026-09-02 · Script: `scripts/bonifica/edge-orfani.mjs`

## Metodo
- **Lente 1 (statica)**: grafo dei chiamanti su `src/`, `supabase/functions/`, `supabase/migrations/`,
  `scripts/` (pattern `functions.invoke('nome')`, URL `/functions/v1/nome`, riferimenti SQL).
- **Lente 2 (traffico reale)**, tre fonti incrociate:
  - `cron.job` → `.lovable/bonifica/edge-cron-invoked.json`
  - `edge_metrics` (30 gg), `ai_prompt_log`, `ai_invocation_audit`, `system_loops`,
    log di piattaforma `function_edge_logs` → `.lovable/bonifica/edge-traffic-observed.json`

## Quadro
| Categoria | Conteggio |
|---|---|
| Edge functions totali | 150 |
| Chiamate dal repo | 67 |
| Invocate solo da cron DB | 8 |
| Vive solo per traffico osservato (falsi orfani smascherati) | 6 |
| **Candidati orfani** | **69** |
| di cui endpoint esterni legittimi (vedi sotto) | 8 |
| **Candidati orfani reali** | **61** |

## Falsi orfani smascherati dalla Lente 2
`ai-query-planner`, `daily-briefing`, `linkedin-ai-extract`, `sherlock-extract`,
`suggest-email-groups`, `whatsapp-ai-extract` — nessun chiamante statico nel repo, ma prompt/log
recenti in `ai_prompt_log`. Invocazione dinamica: **non toccare**.

## Traffico misurato (fonti applicative)
| Funzione | Segnale | Ultimo |
|---|---|---|
| outreach-scheduler | 8312 (edge_metrics) | 2026-09-02 |
| agent-autopilot-worker | 1387 (edge_metrics) | 2026-09-02 |
| tmwe-oauth-start | 127 (function_edge_logs) | 2026-09-02 |
| ai-assistant / ai-query-planner | 48 + 48 | 2026-08-31 |
| generate-email / journalist-review | 84 / 45 | 2026-08-31 |
| funnemail-classify / funnemail-auto-route | 4 / 2 | 2026-08-07 |
| check-inbox | 1 | 2026-08-31 |

> **Limite dichiarato**: solo 11 funzioni su 150 scrivono su `edge_metrics` e i log di piattaforma
> hanno finestra di ritenzione brevissima (poche ore). La Lente 2 sulle edge resta **parziale**:
> assenza di traffico non equivale a funzione morta. Nessuna rimozione può basarsi solo su questo.

## Invocate solo da cron DB (VIVE, non toccare)
agent-task-drainer · ai-backup · batch-enrichment-worker · cadence-engine ·
classify-emails-batch · funnemail-reminders-tick · kb-doctrine-audit · process-inbound-enrichment

## Endpoint esterni legittimi (chiamati fuori dal repo — VIVI)
`mcp`, `receive-channel-message`, `email-delivery-webhook`, `voice-brain-bridge`,
`super-mario`, `save-wca-cookie`, `save-ra-cookie`, `install-vault-service-role-key`

## Candidati orfani reali (61) — quarantena Q2, scadenza 2026-10-02
agent-audit, agent-loop, agent-simulate, agentic-decide, ai-deep-search-helper,
ai-match-business-cards, ai-monitor, ai-tracking-healthcheck, ai-utility, analyze-email-edit,
analyze-import-structure, analyze-partner, apply-classification-insight, backfill-email-rules,
calculate-lead-scores, calculate-partner-quality, check-external-db, check-inbox-booking,
confirm-injection-review, consume-credits, country-kb-generator, decision-dashboard,
deduplicate-contacts, deduplicate-partners, dispatch-integrity-check, email-imap-proxy,
funnemail-backfill-inbound, funnemail-send-autoresponder, generate-content, get-ra-credentials,
get-wca-credentials, imap-list-folders, improve-email, kb-index-map, kb-ingest-document,
kb-intake-analyze, learn-from-group-correction, linkedin-profile-api, list-elevenlabs-voices,
log-action, manage-email-folders, mission-executor, parse-business-card, parse-profile-ai,
process-ai-import, process-download-job, process-email-queue, prompt-registry-drift-check,
recalculate-partner-quality, replay-domain-events, response-pattern-aggregator, review-message,
save-correction-memory, save-ra-prospects, save-wca-contacts, send-linkedin, send-whatsapp,
simulate-funnemail-classify, sync-business-cards, translate-text, wca-country-counts

## Regola di uscita dalla quarantena
Una funzione esce dalla lista solo con prova positiva: chiamante trovato, traffico registrato,
o job/cron/webhook dichiarato. Alla scadenza, la rimozione avviene per lotti piccoli con deploy
e verifica, mai in blocco.

## Come rigenerare
```
node scripts/bonifica/edge-orfani.mjs
```
Gli snapshot JSON vanno riaggiornati dal DB prima di ogni revisione del lotto.

## Bias dichiarato: kill-switch cron attivo (rilevato 2026-09-02)

`system_flags.cron_paused = true` dal **2026-08-01**. Verifiche:
- `cron_runs`: 0 righe negli ultimi 30 giorni;
- log edge recenti: `cron_paused_skip` su `agent-task-drainer` e `outreach_scheduler`;
- `edge_metrics`: ~330 eventi/giorno, quindi il traffico osservato e' **solo di origine UI/manuale**.

Conseguenza sulla Lente 2: per tutte le funzioni la cui unica sorgente di invocazione e'
un cron job, l'assenza di traffico negli ultimi 30 giorni **non e' prova di morte**.
Candidati Q2 potenzialmente affetti da questo bias (catene cron-driven):
`agent-loop`, `mission-executor`, `process-email-queue`, `check-inbox-booking`,
`calculate-lead-scores`, `response-pattern-aggregator`, `dispatch-integrity-check`,
`prompt-registry-drift-check`, `funnemail-send-autoresponder`, `replay-domain-events`.

Regola aggiuntiva: nessuna rimozione dalla quarantena Q2 finche' il kill-switch non e' stato
riattivato per almeno 7 giorni consecutivi con metriche raccolte. La riattivazione e' una
decisione operativa dell'utente (riattiva invii reali), non della bonifica.
