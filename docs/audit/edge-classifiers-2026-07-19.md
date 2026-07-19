# Audit — Classificatori Email Edge (2026-07-19)

Punto 4 dei 7 (riduzione Edge Functions). Analisi dei 5 classificatori email
per capire se sono davvero consolidabili senza rompere il flusso.

## Inventario

| Funzione | LOC | Responsabilità | Verdetto |
|---|---|---|---|
| `classify-inbound-message` | 191 | Orchestrator: injection guard → ownership → AI classification → post-pipeline (funnemail, content, context, alert). Decomposto in stage sub-200 LOC. | **Mantieni** — è la spina dorsale. |
| `classify-inbound-content` | 485 | Content intelligence: label, intent_summary, suggested_actions con prompt editabile. Idempotente su `email_content_intelligence`. Invocato fail-safe dall'orchestrator SOLO per channel=email. | **Mantieni** — dominio distinto, isolabile. |
| `funnemail-classify` | 279 | Decisione routing verso cartelle `funnemail_folders` (nessuna lista hardcoded). Output in `funnemail_decisions`. Auth interna. | **Mantieni** — logica funnemail dedicata. |
| `classify-email-response` | 422 | Classificazione **reply** con lead status guard, routing rules e supervisor audit. Diverso dominio (reply, non inbound). | **Mantieni** — orientato reply/status. |
| `classify-emails-batch` | 140 | Retry batch quando il trigger DB `on_inbound_message` fallisce. Chiama `classify-inbound-message` con dedup via `reply_classifications`. | **Mantieni** — safety net. |

## Conclusione

**Nessun consolidamento meccanico**: ogni funzione ha responsabilità distinta,
trigger di invocazione distinto (orchestrator vs content vs routing vs reply vs
batch), e output su tabelle diverse. Fondere due qualsiasi introdurrebbe
coupling non giustificato.

Il vero over-count viene da:
- `simulate-funnemail-classify` (test-only, isolabile in dev)
- `refine-classification-rule` (admin utility)
- `apply-classification-insight` (feedback loop)

**Azione proposta (non eseguita)**: spostare le 3 sopra sotto `_dev/` con
`verify_jwt=true` obbligatorio, e documentarle come "admin-only" nel catalogo
edge. Riduzione: 3 endpoint pubblici in meno senza toccare il flusso live.

Owner: da assegnare. Rischio: basso. Blocker: verificare che nessun cron o
dashboard admin dipenda dagli endpoint pubblici prima dello spostamento.