

# Pipeline Automatica: Estrazione Contatti via Chrome Extension

## Problema
Lo scraper server-side scarica i profili WCA ma il WAF/Cloudflare blocca i dati privati (nomi, email, telefoni dei contatti). L'estensione Chrome li vede perche' opera nel browser autenticato, ma attualmente richiede di inserire manualmente gli ID -- inutile.

## Soluzione
Integrare l'estensione Chrome direttamente nella pipeline di Acquisizione Partner. Il flusso diventa completamente automatico:

1. Il server scarica i dati base (azienda, indirizzo, network) -- funziona gia'
2. La webapp chiede all'estensione di estrarre i contatti privati per ogni profilo
3. L'estensione apre la pagina in background, legge i contatti reali dal DOM, e li salva nel database
4. La pipeline continua al partner successivo

L'utente non tocca nulla. Basta che l'estensione sia installata e autenticata.

## Come comunicano webapp e estensione

L'estensione dichiara nel manifest che accetta messaggi dal nostro dominio (`externally_connectable`). La webapp usa `chrome.runtime.sendMessage()` per inviare comandi direttamente all'estensione.

```text
Webapp (Acquisizione)          Chrome Extension
       |                              |
       |-- sendMessage({wcaId: 123})-->|
       |                              | apre tab background
       |                              | estrae contatti dal DOM
       |                              | salva via save-wca-contacts
       |<-- risposta {contacts: [...]}|
       |                              |
       | prossimo partner...          |
```

## Modifiche

### 1. Chrome Extension - manifest.json
Aggiungere `externally_connectable` per permettere alla webapp di inviare messaggi:
```json
"externally_connectable": {
  "matches": [
    "https://*--c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovable.app/*",
    "https://wca-network-navigator.lovable.app/*",
    "http://localhost:*/*"
  ]
}
```

### 2. Chrome Extension - popup.js (+ background listener)
Aggiungere un listener `chrome.runtime.onMessageExternal` che:
- Riceve `{ action: "extractContacts", wcaId: 12345 }` dalla webapp
- Apre il profilo in tab background
- Esegue `extractContactsFromPage()` (gia' esistente)
- Salva i contatti via `save-wca-contacts` (gia' esistente)
- Risponde con i contatti estratti

Serve un **background service worker** (`background.js`) perche' `onMessageExternal` funziona solo nel service worker, non nella popup.

### 3. Chrome Extension - background.js (nuovo file)
Service worker che:
- Ascolta messaggi esterni dalla webapp
- Gestisce `extractContacts`, `ping` (per verificare che l'estensione sia installata)
- Contiene la logica di apertura tab + estrazione + invio al server

### 4. Webapp - AcquisizionePartner.tsx
Dopo il download server-side di ogni partner:
- Verifica se l'estensione e' installata (`chrome.runtime.sendMessage` con `ping`)
- Se si': invia `extractContacts` con il `wcaId` e attende i contatti reali
- Aggiorna il canvas con i contatti estratti dall'estensione
- Se no: mostra un avviso una tantum che l'estensione migliorerebbe i risultati

### 5. Webapp - Hook useExtensionBridge.ts (nuovo)
Hook dedicato per la comunicazione con l'estensione:
- `isExtensionAvailable`: controlla se l'estensione risponde al ping
- `extractContacts(wcaId)`: chiede all'estensione di estrarre i contatti
- Gestisce timeout e errori gracefully

## Dettagli Tecnici

### Flusso pipeline modificato (AcquisizionePartner)

```text
Per ogni partner selezionato:
  1. DOWNLOAD (server-side) -> dati base azienda
  2. EXTRACT CONTACTS (estensione Chrome) -> contatti privati
  3. ENRICH + DEEP SEARCH (server-side, parallelo) -> dati extra
  4. Animazione completamento -> bin
```

Il passo 2 e' nuovo. Se l'estensione non e' disponibile, si salta e si usano i contatti (probabilmente vuoti) dal server.

### Extension ID
Per `sendMessage` serve l'Extension ID. Dato che l'estensione e' caricata manualmente (non dal Chrome Web Store), l'ID cambia per ogni installazione. La soluzione:
- L'estensione, al primo avvio, salva il suo ID nel database (`app_settings` con key `chrome_extension_id`)
- La webapp legge l'ID da `app_settings` prima di comunicare
- In alternativa, si usa `window.postMessage` come fallback (meno pulito ma funziona senza ID)

### Fallback: content script + window.postMessage
Se `externally_connectable` risulta troppo fragile (ID dinamico), si puo' usare un content script iniettato nelle pagine della webapp che ascolta `window.postMessage`. Questo non richiede di conoscere l'Extension ID.

**Approccio scelto: content script** (piu' robusto per estensioni caricate manualmente)

- `content.js`: iniettato nella webapp, ascolta `window.postMessage({ type: "WCA_EXTRACT", wcaId })` e comunica col background
- `background.js`: riceve dal content script, apre tab, estrae, risponde
- La webapp posta un messaggio e attende la risposta

### File da creare/modificare

| File | Azione |
|------|--------|
| `public/chrome-extension/manifest.json` | Aggiungere `background.service_worker` e `content_scripts` |
| `public/chrome-extension/background.js` | **Nuovo** - service worker con logica estrazione |
| `public/chrome-extension/content.js` | **Nuovo** - bridge postMessage tra webapp e background |
| `public/chrome-extension/popup.js` | Spostare `extractContactsFromPage` e `sendContactsToServer` in background.js, popup li chiama via messaging |
| `src/hooks/useExtensionBridge.ts` | **Nuovo** - hook per comunicare con l'estensione |
| `src/pages/AcquisizionePartner.tsx` | Integrare estrazione contatti via estensione nel pipeline |

### Sicurezza
- Il content script si attiva SOLO sui domini della webapp (non su siti terzi)
- L'estensione non espone dati sensibili alla pagina, solo i contatti estratti
- Le credenziali WCA restano nel server, mai esposte alla webapp

