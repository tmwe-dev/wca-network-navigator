## Diagnosi confermata (3.9.48)

Verificato su `public/linkedin-extension/actions.js` + `hybrid-ops.js` + `LinkedInTest.tsx`. Le 5 contestazioni dell'utente sono tutte vere:

1. **Due pipeline divergenti.** `sendLinkedInMessage` (riga 20, path standard usato dalla UI reale via `background.js:77`) ha ancora `await TabManager.sleep(3000)` (riga 107) dopo `clickMessage`. `sendLinkedInMessageWithMethod` (riga 171, diagnostico) usa `waitForComposerReady`. Il gate stile WhatsApp esiste solo nel path diagnostico.
2. **Tab LinkedIn esistente viene navigata.** `TabManager.getLinkedInTab(url, false, false)` non crea nuove tab ma fa `chrome.tabs.update({url})` se la tab è su un'altra pagina LinkedIn. Comportamento da rivedere ma non in scope di questo fix (è già focus-safe).
3. **Fallback dopo gate fallito.** `actions.js:473-474` fa `HybridOps.sendMessage(tab.id, message)` se `waitForComposerReady` timeout. Concettualmente sbagliato: nasconde la causa.
4. **Writer in cascata.** `HybridOps.sendMessage` prova paste → execCommand → appendChild → InputEvent → click → form submit → Ctrl+Enter → CDP click → CDP Ctrl+Enter senza verificare prima se il send button è realmente abilitato.
5. **UI test thread.** `LinkedInTest.tsx` chiede ancora URL manuale per "Leggi Thread" / "Backfill" anche quando `foundThreads[].threadUrl` è disponibile dalla inbox.

## Piano di intervento (3.9.49)

### Fix 1 — Pipeline unica `sendLinkedInMessageCore`

Estrarre in `actions.js` una funzione condivisa:

```text
sendLinkedInMessageCore({ tabId, target, message, method? })
  ├─ pulizia overlay stale
  ├─ probe composer + URL guard
  ├─ se composer non aperto → HybridOps.clickMessage
  ├─ HybridOps.waitForMessageComposer(tabId, 30000)   ← gate reale
  ├─ se gate fallisce → return composer_gate_failed (NO fallback writer)
  └─ HybridOps.sendMessage(tabId, message, { method, requireSendEnabled:true })
```

Sia `sendLinkedInMessage` che `sendLinkedInMessageWithMethod` diventano wrapper sottili attorno a `sendLinkedInMessageCore`. Rimuovere ogni `TabManager.sleep(3000)` post-click in entrambi i path.

### Fix 2 — Esporre `waitForMessageComposer` da `HybridOps`

In `hybrid-ops.js` aggiungere e esportare `waitForMessageComposer(tabId, maxWaitMs)` che fa polling (deep shadow query) per textbox visibile + interattiva. Riusare la stessa logica oggi duplicata in `waitForComposerReady` di `actions.js` (rimuoverla da actions e delegare a HybridOps per avere una sola implementazione).

### Fix 3 — Gate fallito = stop diagnostico

Eliminare il blocco `actions.js:473-481` (`fallback HybridOps.sendMessage` dopo gate timeout). Restituire:

```json
{ "success": false, "error": "composer_gate_failed: <diagnostica>", "diagnostic": {...} }
```

Nessun writer di backup.

### Fix 4 — Separare write da send in `HybridOps.sendMessage`

Refactor in due fasi atomiche:

```text
writeIntoComposer(tabId, message)
  → { textCommitted: bool, sendButtonEnabled: bool, diagnostic }

if (!textCommitted) return write_failed
if (!sendButtonEnabled) return send_button_not_enabled_after_write
// SOLO ora:
clickSend(tabId) → { sent: bool }
```

Eliminare i fallback di invio (form submit / Ctrl+Enter / CDP click / CDP Ctrl+Enter) quando `sendButtonEnabled === false`. Mantenere solo il click fisico sul bottone Send una volta che il bottone è realmente abilitato. Se il click non parte, return `send_click_failed` con diagnostica (no cascata).

### Fix 5 — UI test usa threadUrl dalla inbox

In `LinkedInTest.tsx`:

- Aggiungere stato `selectedThreadUrl` collegato al `<select>` dei `foundThreads`.
- Bottoni "Leggi Thread" e "Backfill Thread":
  - se `selectedThreadUrl` presente → usa quello, nessun campo manuale richiesto;
  - se assente → bottone disabilitato con `tooltip: "threadUrl mancante dalla lettura inbox"`.
- Il campo manuale `threadUrl` resta come override opzionale ma non più obbligatorio.

### Packaging

- Bump `manifest.json` → **3.9.49**, descrizione: "Pipeline unica + gate reale nel path standard + write/send separati".
- Aggiornare `src/lib/whatsappExtensionZip.ts` (`LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.49"`, marcare 3.9.48 `current:false`).
- Aggiornare `public/chrome-extensions/catalog.json` (`latestVersion: "3.9.49"`, nuova entry `current:true`).
- Rigenerare `public/chrome-extensions/linkedin/linkedin-extension-3.9.49.zip` e `public/linkedin-extension.zip`.
- Verificare nel ZIP: presenza di `sendLinkedInMessageCore`, assenza di `sleep(3000)` dopo `clickMessage`, assenza del fallback `HybridOps.sendMessage` post-gate.

## Cosa NON tocco

- `TabManager.getLinkedInTab` (la navigazione della tab esistente resta — è focus-safe e fuori scope).
- `clickMessage`, `readLinkedInThread`, `backfillLinkedInThread`, rubrica, DB, dedup, KPI, Partner Connect.
- Nessun cambio a `check-inbox` / IMAP / `mark-imap-seen`.

## Esito atteso

- Path standard e diagnostico identici fino al gate.
- Niente più `sleep(3000)` cieco prima dell'invio reale.
- Se il composer non si monta davvero: errore chiaro `composer_gate_failed`, niente cascata che maschera il problema.
- Se il send button non si abilita: `send_button_not_enabled_after_write`, niente Ctrl+Enter/CDP che inviano testo non commit.
- UI test usa direttamente i thread restituiti dalla inbox.
- Utente reinstalla **3.9.49** da `chrome://extensions`.
