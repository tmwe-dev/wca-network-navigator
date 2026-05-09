# LinkedIn Extension 3.9.50 — Due modalità composer

## Diagnosi confermata

Il log `composer_gate_timeout 30s` non è un problema di "click Send". È che **LinkedIn in background non monta il composer in modo affidabile**: il click su "Messaggia" sintetico su tab non attiva spesso non apre l'overlay, oppure il textbox non viene mai montato. WhatsApp tollera il background, LinkedIn no.

Continuare a patchare selectors / fallback su `clickMessage` in background è la trappola: ogni patch aggiunge un selector in più ma il modello resta sbagliato.

## Decisione

Separare due modalità esplicite, **default safe**:

- **`background_existing_composer`** (default): non attiva la tab, non clicca "Messaggia", non apre overlay. Cerca SOLO un composer già aperto. Se non c'è → errore chiaro in 3-4s.
- **`interactive_open_composer`** (opt-in): porta la tab LinkedIn in foreground, clicca "Messaggia", aspetta composer fino a 30s, invia. Rispetta meno il vincolo "non portarmi via dalla webapp", quindi disabilitato di default.

## Modifiche

### 1. `public/linkedin-extension/actions.js` — `sendLinkedInMessageCore`

Aggiungere parametro `mode` (default `"background_existing_composer"`):

```text
sendLinkedInMessageCore(profileUrl, message, { method, mode })
  ├─ getLinkedInTab (allowCreate=false, focus-safe) — invariato
  ├─ se mode === "background_existing_composer":
  │     ├─ probe = await HybridOps.probeComposer(tab.id, 4000)
  │     ├─ se !probe.success → errore "composer_not_open_background_mode"
  │     │       messaggio UI: "Apri la chat LinkedIn con il destinatario,
  │     │       lascia il box messaggio visibile, poi riprova."
  │     └─ HybridOps.sendMessage(tab.id, message)
  └─ se mode === "interactive_open_composer":
        ├─ TabManager.bringTabToFront(tab.id)
        ├─ HybridOps.clickMessage(tab.id)
        ├─ HybridOps.waitForMessageComposer(tab.id, 30000)
        ├─ se gate fail → errore "composer_gate_failed_interactive"
        └─ HybridOps.sendMessage(tab.id, message)
```

Rimuovere dal path background: `findMessageBtn`, `clickMessage`, `findMoreBtn`, gate 30s. Sono proprio i pezzi che falliscono in tab non attiva.

### 2. `public/linkedin-extension/hybrid-ops.js`

- Aggiungere `probeComposer(tabId, maxWaitMs = 4000)`: poll breve di textbox visibile/interagibile usando `deepQueryAll`. Ritorna `{ success, found, diagnostic }`. Niente click, niente apertura overlay.
- `waitForMessageComposer(tabId, 30000)` resta, usato SOLO da `interactive_open_composer`.
- `bringTabToFront(tabId)`: helper che fa `chrome.tabs.update(tabId, { active: true })` + `chrome.windows.update(windowId, { focused: true })`. Usato SOLO da modalità interactive.

### 3. `public/linkedin-extension/background.js` (router messaggi)

Accettare `mode` nel payload. Default a `"background_existing_composer"` se assente. Validare valore.

### 4. `src/components/test-extensions/LinkedInTest.tsx`

Sostituire i pulsanti attuali con tre pulsanti distinti per separare i fallimenti:

1. **"Test composer aperto"** — chiama solo `probeComposer` via nuovo handler `linkedin_probe_composer`. Mostra esito (trovato/non trovato) + diagnostic.
2. **"Invia (background, composer aperto)"** — invio con `mode: "background_existing_composer"`. Default consigliato.
3. **"Invia (interactive, apre composer)"** — invio con `mode: "interactive_open_composer"`. Avviso UI: "Porterà LinkedIn in primo piano".

Toggle radio sopra ai pulsanti per modalità default. Tooltip esplicativi. Niente cambi a logica thread/backfill.

### 5. Errori e messaggi

Codici nuovi in `Config.ERROR` / messaggi:
- `composer_not_open_background_mode` → testo UI: *"Apri la chat LinkedIn con il destinatario, lascia il box messaggio visibile, poi riprova. Oppure usa modalità interactive."*
- `composer_gate_failed_interactive` → diagnostic dettagliato (readyState, btnFound, overlayMounted, textboxFound).

Eliminare il messaggio fuorviante *"Composer non montato in tempo. Riprova: spesso al secondo tentativo la pagina è già calda"* — è un workaround, non una soluzione.

### 6. Packaging

- Bump `manifest.json` → `3.9.50`.
- Aggiornare `src/lib/whatsappExtensionZip.ts` e `public/chrome-extensions/catalog.json`.
- Rigenerare `public/chrome-extensions/linkedin/linkedin-extension-3.9.50.zip` e `public/linkedin-extension.zip`.

## Fuori scope (non tocco)

- `TabManager.getLinkedInTab` (focus-safe, allowCreate=false) — resta com'è.
- `readLinkedInThread`, `backfillLinkedInThread`.
- Rubrica, DB, dedup, KPI, Partner Connect, `check-inbox`, IMAP.
- WhatsApp extension.

## Cosa cambia per l'utente

- Default safe: se la chat non è aperta, fail in 3-4s con istruzione chiara, senza più timeout 30s.
- Test UI con 3 pulsanti separati permette di isolare il punto di rottura (probe / write / send) invece di vedere un solo "Timeout 30s" opaco.
- Modalità interactive disponibile come opt-in per chi accetta il foreground.
