# Extension Bridge Protocol — WCA Network Navigator

## Overview

Le estensioni Chrome comunicano con la web app WCA tramite `window.postMessage`.
Questo protocollo è bidirezionale: la web app invia richieste, l'estensione risponde.

## Formato Richiesta (App → Estensione)

```json
{
  "source": "wca-app",
  "target": "linkedin-scraper",
  "action": "extractProfile",
  "payload": {},
  "requestId": "uuid-v4"
}
```

| Campo       | Tipo     | Descrizione                                    |
|-------------|----------|------------------------------------------------|
| `source`    | string   | Sempre `"wca-app"`                             |
| `target`    | string   | Nome dell'estensione destinataria              |
| `action`    | string   | Azione da eseguire                             |
| `payload`   | object   | Parametri (varia per action)                   |
| `requestId` | string   | UUID per correlare richiesta/risposta          |

## Formato Risposta (Estensione → App)

```json
{
  "source": "linkedin-scraper",
  "requestId": "same-uuid",
  "ok": true,
  "data": { ... }
}
```

In caso di errore:
```json
{
  "source": "linkedin-scraper",
  "requestId": "same-uuid",
  "ok": false,
  "error": "Messaggio errore"
}
```

## Azioni Obbligatorie

### `ping`
Handshake — l'estensione conferma di essere attiva.

**Payload:** `{}`
**Risposta:** `{ ok: true, data: { version: "1.0" } }`

### `extractProfile` (solo linkedin-scraper)
Estrae dati dal profilo LinkedIn nella tab attiva.

**Payload:** `{}`
**Risposta:**
```json
{
  "ok": true,
  "data": {
    "url": "https://linkedin.com/in/...",
    "name": "Mario Rossi",
    "headline": "CEO at Acme Logistics",
    "company": "Acme Logistics",
    "position": "CEO",
    "location": "Milan, Italy",
    "email": "mario@acme.com",
    "phone": "+39 02 1234567",
    "about": "..."
  }
}
```

## Implementazione Content Script

```javascript
window.addEventListener("message", async (event) => {
  const msg = event.data;
  if (!msg || msg.source !== "wca-app") return;
  if (msg.target !== "MY_EXTENSION_NAME") return;

  try {
    let result;
    switch (msg.action) {
      case "ping":
        result = { version: "1.0" };
        break;
      case "extractProfile":
        result = await doExtractProfile();
        break;
      default:
        throw new Error(`Action sconosciuta: ${msg.action}`);
    }

    window.postMessage({
      source: "MY_EXTENSION_NAME",
      requestId: msg.requestId,
      ok: true,
      data: result,
    }, "*");
  } catch (err) {
    window.postMessage({
      source: "MY_EXTENSION_NAME",
      requestId: msg.requestId,
      ok: false,
      error: err.message,
    }, "*");
  }
});
```

## Timeout

La web app attende 30 secondi. Se l'estensione non risponde, mostra errore timeout.

## Sicurezza

- Comunicazione solo via `window.postMessage` — nessuna API Chrome esposta
- Il `requestId` UUID previene collisioni tra richieste concorrenti
- L'estensione deve filtrare per `source === "wca-app"` e `target === "nome-proprio"`

---

## Contratto congelato — invio/download LinkedIn & WhatsApp (v3.9.56+)

Versione minima estensione LinkedIn richiesta: **3.9.56**.
Versione minima estensione WhatsApp richiesta: **5.10.x**.

### LinkedIn — azioni ammesse

| Action | Direction (req → resp) | Timeout | Uso |
|---|---|---|---|
| `ping` / `setConfig` | `from-webapp-li` → `from-extension-li` | 4s / immediato | health + config |
| `sendMessage` | `from-webapp-li` → `from-extension-li` | **120s** | unico path di invio (HybridOps.sendMessage) |
| `readLinkedInInbox` | `from-webapp-li` → `from-extension-li` | 35s | download inbox |
| `readLinkedInThread` | `from-webapp-li` → `from-extension-li` | 30s | download singolo thread |
| `backfillLinkedInThread` | `from-webapp-li` → `from-extension-li` | 120s | recupero storico |
| `diagnosticLinkedInDom` | `from-webapp-li` → `from-extension-li` | 30s | diagnostica |

### WhatsApp — azioni ammesse

| Action | Direction | Timeout | Uso |
|---|---|---|---|
| `ping` / `verifySession` | `from-webapp-wa` → `from-extension-wa` | 5s / 30s | health + auth |
| `sendWhatsApp` | `from-webapp-wa` → `from-extension-wa` | **60s** | unico path di invio |
| `readUnread` / `listSidebarChats` | `from-webapp-wa` → `from-extension-wa` | 60s | download inbox |
| `readThread` | `from-webapp-wa` → `from-extension-wa` | 60s | download thread |
| `backfillChat` | `from-webapp-wa` → `from-extension-wa` | 120s | recupero storico |
| `learnDom` | `from-webapp-wa` → `from-extension-wa` | 90s | DOM learning AI |

Aggiungere nuove action o modificare timeout richiede aggiornamento di questo
documento + bump versione estensione.

### SSOT app-side — `src/lib/messaging/`

L'app **non chiama mai i bridge direttamente fuori da questo modulo**.

| Funzione | Quando usarla |
|---|---|
| `sendLinkedInDirect()` | solo chat LinkedIn manualmente aperta dall'utente |
| `queueLinkedInForApproval()` | bulk, cadenze, AI, autopilot, classificatore email |
| `sendWhatsAppDirect()` | solo chat WA manualmente aperta dall'utente |
| `queueWhatsAppForApproval()` | bulk, cadenze, AI, autopilot, classificatore email |
| `linkedinDownloader.ts` / `whatsappDownloader.ts` | re-export degli hook download (sync + backfill) |

### Regola di approvazione (NON negoziabile)

Qualunque invio LI/WA che **non** parta da una chat aperta manualmente
dall'utente deve essere predisposto in `ai_pending_actions`
(`action_type` ∈ `send_linkedin`, `send_whatsapp`) e attendere
approvazione esplicita. L'unico processo autorizzato a invocare le edge
`send-linkedin` / `send-whatsapp` dopo approvazione è
`pending-action-executor`.

ESLint guard: `no-direct-extension-send` segnala chiamate a
`.sendWhatsApp(...)` fuori dai SSOT.
