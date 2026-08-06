# Inventario Edge Functions — prova di utilizzo

Generato da `scripts/audit-edge-usage.mjs`. Funzioni totali: **149**.

Colonne: chiamate dal frontend, riferimenti nelle migrazioni (cron/pg_net), riferimenti da altre funzioni, peso in KB.

## Senza alcun chiamante rilevato: 24

Candidate allo spegnimento controllato. Nessuna cancellazione senza periodo di osservazione dei log.

| Funzione | KB |
| --- | ---: |
| ai-tracking-healthcheck | 3 |
| calculate-partner-quality | 4 |
| check-external-db | 3 |
| check-inbox-booking | 96 |
| confirm-injection-review | 3 |
| decision-dashboard | 7 |
| dispatch-integrity-check | 9 |
| email-delivery-webhook | 4 |
| email-imap-proxy | 18 |
| funnemail-backfill-inbound | 6 |
| funnemail-reminders-tick | 7 |
| funnemail-send-autoresponder | 6 |
| get-wca-credentials | 2 |
| imap-list-folders | 12 |
| install-vault-service-role-key | 2 |
| mark-imap-seen | 13 |
| mcp | 5 |
| prompt-registry-drift-check | 3 |
| receive-channel-message | 7 |
| record-e2e-run | 3 |
| response-pattern-aggregator | 9 |
| save-wca-contacts | 17 |
| sync-wca-partners | 10 |
| tmwe-oauth-callback | 14 |

## Inventario completo

| Funzione | Frontend | Migrazioni | Altre funzioni | KB |
| --- | ---: | ---: | ---: | ---: |
| agent-execute | 16 | 0 | 3 | 203 |
| ai-assistant | 17 | 2 | 3 | 198 |
| check-inbox | 3 | 3 | 1 | 102 |
| generate-email | 16 | 5 | 3 | 101 |
| check-inbox-booking | 0 | 0 | 0 | 96 |
| generate-outreach | 6 | 1 | 3 | 56 |
| super-mario | 2 | 0 | 0 | 42 |
| classify-inbound-message | 3 | 5 | 3 | 31 |
| send-email | 10 | 2 | 1 | 26 |
| improve-email | 9 | 1 | 4 | 25 |
| apply-email-rules | 3 | 0 | 0 | 24 |
| backfill-email-rules | 1 | 0 | 0 | 24 |
| cadence-engine | 2 | 0 | 1 | 22 |
| voice-brain-bridge | 0 | 2 | 2 | 22 |
| agent-autonomous-cycle | 1 | 3 | 1 | 21 |
| analyze-import-structure | 3 | 0 | 1 | 20 |
| manage-email-folders | 4 | 0 | 0 | 20 |
| whatsapp-ai-extract | 2 | 0 | 1 | 20 |
| classify-inbound-content | 0 | 0 | 2 | 19 |
| email-imap-proxy | 0 | 0 | 0 | 18 |
| process-ai-import | 2 | 0 | 1 | 18 |
| process-email-queue | 4 | 0 | 0 | 18 |
| suggest-email-groups | 5 | 0 | 2 | 18 |
| finder-api-chat | 2 | 1 | 0 | 17 |
| funnemail-auto-route | 0 | 0 | 1 | 17 |
| optimus-analyze | 5 | 0 | 1 | 17 |
| prompt-test-runner | 2 | 2 | 0 | 17 |
| save-wca-contacts | 0 | 0 | 0 | 17 |
| memory-promoter | 2 | 1 | 0 | 16 |
| parse-profile-ai | 1 | 0 | 1 | 16 |
| enrich-partner-website | 4 | 1 | 1 | 15 |
| funnemail-classify | 2 | 2 | 2 | 15 |
| outreach-scheduler | 0 | 3 | 0 | 15 |
| agent-simulate | 3 | 0 | 0 | 14 |
| generate-aliases | 8 | 0 | 2 | 14 |
| kb-supervisor | 10 | 1 | 5 | 14 |
| prompt-copilot-chat | 2 | 1 | 0 | 14 |
| scrape-website | 8 | 0 | 0 | 14 |
| tmwe-oauth-callback | 0 | 0 | 0 | 14 |
| ai-query-planner | 2 | 1 | 1 | 13 |
| analyze-partner | 4 | 1 | 1 | 13 |
| mark-imap-seen | 0 | 0 | 0 | 13 |
| refine-classification-rule | 1 | 1 | 0 | 13 |
| sherlock-extract | 5 | 1 | 2 | 13 |
| imap-list-folders | 0 | 0 | 0 | 12 |
| send-linkedin | 2 | 1 | 1 | 12 |
| simulate-funnemail-classify | 2 | 0 | 0 | 12 |
| agent-loop | 5 | 0 | 5 | 11 |
| email-cron-sync | 1 | 3 | 0 | 11 |
| funnemail-scout-sender | 0 | 0 | 1 | 11 |
| harmonize-proposal-chat | 3 | 1 | 0 | 11 |
| pending-action-executor | 3 | 1 | 0 | 11 |
| replay-domain-events | 2 | 0 | 0 | 11 |
| browser-action | 3 | 0 | 0 | 10 |
| refresh-conversation-context | 0 | 0 | 2 | 10 |
| send-whatsapp | 2 | 1 | 1 | 10 |
| sync-wca-partners | 0 | 0 | 0 | 10 |
| tmwe-catalog-sync | 1 | 0 | 0 | 10 |
| agent-audit | 3 | 0 | 0 | 9 |
| agent-autopilot-worker | 0 | 3 | 0 | 9 |
| agentic-decide | 2 | 1 | 1 | 9 |
| ai-arena-suggest | 0 | 0 | 1 | 9 |
| ai-match-business-cards | 1 | 0 | 1 | 9 |
| daily-briefing | 7 | 1 | 4 | 9 |
| dispatch-integrity-check | 0 | 0 | 0 | 9 |
| email-sync-worker | 1 | 2 | 0 | 9 |
| kb-ingest-document | 3 | 1 | 0 | 9 |
| learn-from-group-correction | 1 | 0 | 0 | 9 |
| response-pattern-aggregator | 0 | 0 | 0 | 9 |
| agent-task-drainer | 1 | 0 | 0 | 8 |
| batch-enrichment-worker | 0 | 0 | 1 | 8 |
| calculate-lead-scores | 5 | 0 | 0 | 8 |
| dispatch-urgent-alert | 0 | 0 | 1 | 8 |
| elevenlabs-conversation-token | 3 | 0 | 0 | 8 |
| kb-doctrine-audit | 0 | 1 | 0 | 8 |
| parse-business-card | 3 | 1 | 1 | 8 |
| process-download-job | 1 | 0 | 0 | 8 |
| process-inbound-enrichment | 1 | 1 | 0 | 8 |
| tmwe-customer-sync | 1 | 0 | 0 | 8 |
| agent-prompt-refiner | 1 | 2 | 1 | 7 |
| decision-dashboard | 0 | 0 | 0 | 7 |
| deduplicate-partners | 3 | 0 | 0 | 7 |
| funnemail-reminders-tick | 0 | 0 | 0 | 7 |
| receive-channel-message | 0 | 0 | 0 | 7 |
| run-funnemail-eval | 1 | 0 | 0 | 7 |
| ai-test-runner | 1 | 1 | 0 | 6 |
| classify-emails-batch | 1 | 0 | 0 | 6 |
| command-ask-brain | 3 | 0 | 0 | 6 |
| country-kb-generator | 2 | 0 | 1 | 6 |
| funnemail-backfill-inbound | 0 | 0 | 0 | 6 |
| funnemail-send-autoresponder | 0 | 0 | 0 | 6 |
| kb-embed-backfill | 0 | 1 | 0 | 6 |
| linkedin-ai-extract | 1 | 0 | 1 | 6 |
| mission-executor | 3 | 1 | 1 | 6 |
| smart-scheduler | 1 | 1 | 0 | 6 |
| sync-business-cards | 4 | 0 | 0 | 6 |
| tmwe-partner-match | 1 | 0 | 0 | 6 |
| translate-text | 1 | 0 | 0 | 6 |
| ai-monitor | 2 | 0 | 0 | 5 |
| analyze-email-edit | 2 | 0 | 2 | 5 |
| apply-classification-insight | 1 | 0 | 0 | 5 |
| consume-credits | 1 | 0 | 0 | 5 |
| deduplicate-contacts | 6 | 0 | 0 | 5 |
| elevenlabs-tts | 1 | 0 | 0 | 5 |
| funnemail-policy-engine | 0 | 0 | 1 | 5 |
| funnemail-policy-executor | 0 | 0 | 1 | 5 |
| health-check | 4 | 0 | 0 | 5 |
| kb-intake-analyze | 2 | 0 | 0 | 5 |
| mcp | 0 | 0 | 0 | 5 |
| review-message | 2 | 0 | 0 | 5 |
| tmwe-proxy | 2 | 0 | 0 | 5 |
| unified-assistant | 15 | 0 | 1 | 5 |
| ai-backup | 2 | 1 | 0 | 4 |
| ai-gateway-micro | 1 | 0 | 1 | 4 |
| calculate-partner-quality | 0 | 0 | 0 | 4 |
| email-delivery-webhook | 0 | 0 | 0 | 4 |
| generate-content | 4 | 0 | 0 | 4 |
| get-linkedin-credentials | 2 | 0 | 0 | 4 |
| kb-index-map | 1 | 0 | 0 | 4 |
| kb-promoter | 1 | 1 | 0 | 4 |
| linkedin-profile-api | 1 | 0 | 0 | 4 |
| log-action | 2 | 0 | 0 | 4 |
| memory-embed-backfill | 0 | 1 | 0 | 4 |
| recalculate-partner-quality | 2 | 0 | 0 | 4 |
| save-correction-memory | 4 | 0 | 0 | 4 |
| save-ra-prospects | 1 | 0 | 0 | 4 |
| save-wca-cookie | 1 | 0 | 0 | 4 |
| tmwe-partner-link | 1 | 0 | 0 | 4 |
| tts | 4 | 2 | 1 | 4 |
| ai-deep-search-helper | 1 | 0 | 2 | 3 |
| ai-tracking-healthcheck | 0 | 0 | 0 | 3 |
| categorize-content | 2 | 1 | 3 | 3 |
| check-external-db | 0 | 0 | 0 | 3 |
| confirm-injection-review | 0 | 0 | 0 | 3 |
| export-audit-csv | 2 | 0 | 0 | 3 |
| prompt-registry-drift-check | 0 | 0 | 0 | 3 |
| record-e2e-run | 0 | 0 | 0 | 3 |
| save-linkedin-cookie | 2 | 0 | 0 | 3 |
| save-linkedin-credentials | 1 | 0 | 0 | 3 |
| tmwe-oauth-start | 1 | 0 | 0 | 3 |
| tmwe-quote-lookup | 1 | 0 | 0 | 3 |
| ai-utility | 5 | 0 | 0 | 2 |
| get-ra-credentials | 1 | 0 | 0 | 2 |
| get-wca-credentials | 0 | 0 | 0 | 2 |
| install-vault-service-role-key | 0 | 0 | 0 | 2 |
| list-elevenlabs-voices | 1 | 0 | 0 | 2 |
| save-ra-cookie | 1 | 0 | 0 | 2 |
| wca-country-counts | 1 | 0 | 0 | 2 |
| tmwe-disconnect | 1 | 0 | 0 | 1 |
