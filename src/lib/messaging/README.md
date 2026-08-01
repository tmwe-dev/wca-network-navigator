# `src/lib/messaging/` — SSOT invio/download multicanale

Modulo unico per **inviare** e **scaricare** messaggi LinkedIn e WhatsApp dalla web app.

Regole non negoziabili:

1. Procedura di invio LinkedIn = quella validata sull'estensione **v3.9.56+**:
   `postMessage` con `direction: "from-webapp-li"` e `action: "sendMessage"` (timeout 120s).
   Implementata in `useLinkedInMessagingBridge.sendMessage`. Nessun altro path è ammesso.
2. Procedura di invio WhatsApp = `useWhatsAppExtensionBridge.sendWhatsApp`
   (`from-webapp-wa` / `sendWhatsApp`, timeout 60s).
3. **Solo le chat manuali aperte dall'utente** possono usare i `*Direct(...)`.
   Tutto il resto (bulk, AI, cadenze, classificatore email, autopilot) **deve**
   creare una riga in `ai_pending_actions` con `action_type=send_linkedin` /
   `send_whatsapp` e attendere l'approvazione umana. L'unico consumer
   autorizzato a chiamare le edge `send-linkedin`/`send-whatsapp` dopo
   approvazione è `pending-action-executor`.
4. Procedura di download = `download*Inbox()` / `download*Thread()`. Riusa i
   bridge esistenti (`readLinkedInInbox`, `readLinkedInThread`,
   `backfillLinkedInThread` per LI; `listSidebarChats`, `readThread`,
   `backfillChat` per WA).

ESLint rule `no-direct-extension-send` blocca chiamate dirette a
`bridge.sendMessage` / `bridge.sendWhatsApp` fuori da questo modulo.