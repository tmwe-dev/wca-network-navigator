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
