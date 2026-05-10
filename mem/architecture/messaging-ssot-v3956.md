---
name: Messaging SSOT v3.9.56
description: src/lib/messaging/ è SSOT per invio/download LI+WA; bulk/AI passa SEMPRE da queue*ForApproval (ai_pending_actions); contratto bridge congelato (LI≥3.9.56)
type: feature
---
SSOT in `src/lib/messaging/`:
- `linkedinSender.ts`: `sendLinkedInDirect` (chat manuale) + `queueLinkedInForApproval` (bulk/AI → ai_pending_actions, action_type=send_linkedin)
- `whatsappSender.ts`: `sendWhatsAppDirect` + `queueWhatsAppForApproval`
- `linkedinDownloader.ts` / `whatsappDownloader.ts`: re-export hook sync+backfill

Regola: invii non originati da chat aperta dall'utente DEVONO passare da queue*ForApproval. Unico autorizzato a invocare edge `send-linkedin`/`send-whatsapp` post-approvazione è `pending-action-executor`.

Contratto bridge congelato in `docs/extension-bridge-protocol.md` (azioni + timeout). LI v3.9.56+, WA v5.10+.

ESLint `no-direct-extension-send` (warn) segnala `.sendWhatsApp()` fuori dai SSOT. Test: `src/test/messaging-ssot-governance.test.ts` (3 verdi).

`useBulkLinkedInDispatch` refattorizzato per usare `queueLinkedInForApproval`.
