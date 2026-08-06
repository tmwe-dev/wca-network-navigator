# Fase 3 — Registro di deprecazione Edge Functions (2026-08-06)

Fonte: `docs/audit/edge-usage.md` (149 funzioni, 24 senza chiamanti nel repo).
**Nessuna cancellazione in questa fase.** Le funzioni senza chiamanti statici non sono
necessariamente morte: possono essere invocate da webhook esterni, OAuth callback, cron
o client MCP. Qui vengono classificate per decidere con prove, non per intuizione.

## A. Da MANTENERE — entrypoint esterni (nessun chiamante interno atteso)

| Funzione                       | Motivo                                        |
| ------------------------------ | --------------------------------------------- |
| email-delivery-webhook         | webhook provider email (bounce/delivery)      |
| tmwe-oauth-callback            | callback OAuth TMWE                           |
| receive-channel-message        | webhook inbound canali                        |
| mcp                            | endpoint MCP per client esterni               |
| install-vault-service-role-key | utility di bootstrap, invocata manualmente    |
| get-wca-credentials            | invocata da altre funzioni via fetch dinamico |

## B. Da OSSERVARE — sospette, 30 giorni di log prima di qualsiasi rimozione

ai-tracking-healthcheck, calculate-partner-quality, check-external-db, confirm-injection-review,
decision-dashboard, dispatch-integrity-check, funnemail-backfill-inbound, funnemail-reminders-tick,
funnemail-send-autoresponder, prompt-registry-drift-check, record-e2e-run,
response-pattern-aggregator, save-wca-contacts, sync-wca-partners.

## C. Da CONSOLIDARE — sovrapposizione funzionale con funzioni attive

| Funzione                    | Sovrapposta a               | Nota                                                        |
| --------------------------- | --------------------------- | ----------------------------------------------------------- |
| check-inbox-booking (96 KB) | check-inbox (102 KB)        | quasi-duplicato del motore IMAP: candidato n.1 alla fusione |
| email-imap-proxy            | check-inbox                 | proxy IMAP non più referenziato                             |
| imap-list-folders           | manage-email-folders        | manage-email-folders copre già l'elenco cartelle            |
| mark-imap-seen              | check-inbox (PEEK protocol) | va verificato contro il protocollo BODY.PEEK                |

## Procedura di ritiro (obbligatoria)

1. Osservazione log ≥30 giorni con invocazioni = 0.
2. Deprecazione soft: la funzione risponde 410 con header `x-deprecated`, per un ciclo.
3. Rimozione solo dopo un ciclo senza segnalazioni, una funzione alla volta.

Vietato rimuovere in blocco: ogni funzione tocca almeno un nodo critico (email, auth, pipeline).

## Uniformazione contratto (Fase 3 §10) — 2026-08-06

Aggiunto `npm run audit:edge-contract` (blocking in CI). Non riscrive nulla:
misura quante delle 149 funzioni usano i moduli condivisi e impedisce
regressioni (ratchet). Baseline non conformi al 2026-08-06:

| Requisito | Non conformi |
|---|---|
| CORS condiviso (`_shared/cors.ts`) | 1 (`record-e2e-run`, CORS wildcard su endpoint protetto da `x-e2e-secret`) |
| Auth guard condiviso | 95 |
| Contratto errore (`handleEdgeError`) | 132 |
| Logger strutturato | 144 |

Esclusi dal check CORS perché server-to-server o redirect OAuth: `mcp`,
`replay-domain-events`, `tmwe-oauth-callback`.

Regola: ogni nuova edge function nasce conforme; i baseline scendono a ogni
lotto di uniformazione (`node scripts/audit-edge-contract.mjs --list` elenca
le funzioni da migrare). Nessuna riscrittura di massa: le funzioni vive si
uniformano una famiglia alla volta con verifica funzionale dopo ogni lotto.
