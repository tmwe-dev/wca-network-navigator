# Contatori debito — stato 2026-08-07

Gate: `node scripts/audit-edge-contract.mjs` (ratchet, blocca le regressioni).

| Requisito | Prima | Ora |
| --- | --- | --- |
| CORS condiviso | 0 | 0 |
| Auth assente (bloccante) | 41 | **0** |
| Auth inline da migrare | 54 | 50 |
| Contratto errore (handleEdgeError) | 132 | 132 |
| Logger strutturato | 139 | **66** |

## Cosa è cambiato
- 41 funzioni senza alcuna verifica auth ora usano `requireInternalOrUser` (`_shared/internalAuth.ts`).
- `batch-enrichment-worker` firma le chiamate a `enrich-partner-website` con `buildInternalAuthHeaders()`.
- Il contatore auth è stato separato in due: **assente** (bloccante, 0) e **inline da migrare**
  (funzioni che validano il JWT con `getClaims`/`getUser` nel file: sicure, non ancora uniformate).
- Allow-list `AUTH_EXEMPT`: funzioni pubbliche per contratto o autenticate da secret
  (`health-check`, `mcp`, `tmwe-oauth-callback`, `record-e2e-run`, `email-delivery-webhook`,
  `dispatch-integrity-check`, `install-vault-service-role-key`, `agent-prompt-refiner`).
- 73 funzioni migrate a `createLogger` (`_shared/structuredLogger.ts`).

## Prossimi lotti
1. Logger: restanti 66.
2. `handleEdgeError`: 132.
3. Auth inline → guard condiviso: 50.
