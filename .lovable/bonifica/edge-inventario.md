# Bonifica — Lotto 5: inventario Edge Functions (Lente 1 + Lente 2)

Data: 2026-09-02 · Script: `scripts/bonifica/edge-orfani.mjs`

## Metodo
- **Lente 1 (statica)**: grafo dei chiamanti su `src/`, `supabase/functions/`, `supabase/migrations/`, `scripts/`
  (pattern `functions.invoke('nome')`, URL `/functions/v1/nome`, riferimenti SQL).
- **Lente 2 (traffico)**: `edge_metrics` ultimi 30 giorni + snapshot `cron.job`
  (`.lovable/bonifica/edge-cron-invoked.json`).

## Quadro
| Categoria | Conteggio |
|---|---|
| Edge functions totali | 150 |
| Chiamate dal repo | 67 |
| Invocate solo da cron DB | 8 |
| Falsi orfani smascherati dal traffico | 1 (`ai-query-planner`, 48 hit) |
| Endpoint esterni legittimi (no chiamante interno) | 8 |
| **Candidati orfani reali** | **66** |

## Lente 2 — traffico reale (30gg, `edge_metrics`)
| Funzione | Invocazioni | Ultimo |
|---|---|---|
| outreach-scheduler | 8312 | 2026-09-02 |
| agent-autopilot-worker | 1387 | 2026-09-02 |
| ai-assistant | 48 | 2026-08-31 |
| ai-query-planner | 48 | 2026-08-30 |
| journalist-review | 45 | 2026-08-31 |
| generate-email | 84 | 2026-08-31 |
| funnemail-classify | 4 | 2026-08-07 |
| funnemail-auto-route | 2 | 2026-08-07 |
| check-inbox | 1 | 2026-08-31 |

> **Limite dichiarato**: solo 11 funzioni su 150 scrivono su `edge_metrics`; i log di piattaforma
> non sono interrogabili. La Lente 2 sulle edge è quindi **parziale**: assenza di traffico non
> equivale a funzione morta. Nessuna rimozione può basarsi solo su questo dato.

## Invocate solo da cron DB (VIVE, non toccare)
agent-task-drainer · ai-backup · batch-enrichment-worker · cadence-engine ·
classify-emails-batch · funnemail-reminders-tick · kb-doctrine-audit · process-inbound-enrichment

## Endpoint esterni legittimi (chiamati fuori dal repo — VIVI)
`mcp`, `receive-channel-message`, `email-delivery-webhook`, `voice-brain-bridge`,
`super-mario`, `save-wca-cookie`, `save-ra-cookie`, `install-vault-service-role-key`

## Candidati orfani reali (66) — quarantena Q2, scadenza 2026-10-02
agent-audit, agent-loop, agent-simulate, agentic-decide, ai-deep-search-helper,
ai-match-business-cards, ai-monitor, ai-tracking-healthcheck, ai-utility, analyze-email-edit,
analyze-import-structure, analyze-partner, apply-classification-insight, backfill-email-rules,
calculate-lead-scores, calculate-partner-quality, check-external-db, check-inbox-booking,
confirm-injection-review, consume-credits, country-kb-generator, daily-briefing,
decision-dashboard, deduplicate-contacts, deduplicate-partners, dispatch-integrity-check,
email-imap-proxy, funnemail-backfill-inbound, funnemail-send-autoresponder, generate-content,
get-ra-credentials, get-wca-credentials, imap-list-folders, improve-email, kb-index-map,
kb-ingest-document, kb-intake-analyze, learn-from-group-correction, linkedin-ai-extract,
linkedin-profile-api, list-elevenlabs-voices, log-action, manage-email-folders, mission-executor,
parse-business-card, parse-profile-ai, process-ai-import, process-download-job,
process-email-queue, prompt-registry-drift-check, recalculate-partner-quality,
replay-domain-events, response-pattern-aggregator, review-message, save-correction-memory,
save-ra-prospects, save-wca-contacts, send-linkedin, send-whatsapp, sherlock-extract,
simulate-funnemail-classify, suggest-email-groups, sync-business-cards, translate-text,
wca-country-counts, whatsapp-ai-extract

## Regola di uscita dalla quarantena
Una funzione esce dalla lista solo con prova positiva: chiamante trovato, traffico registrato,
o job/cron/webhook dichiarato. Alla scadenza, la rimozione avviene per lotti piccoli con deploy
e verifica, mai in blocco.
