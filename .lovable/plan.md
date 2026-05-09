## Backup "wa fase 3" + quick win latenza invio WhatsApp

### Step 0 — Backup "wa fase 3"

Copia di sicurezza dei file che verranno toccati, in `archive/wa-fase-3/`:
- `public/whatsapp-extension/actions.js` → `archive/wa-fase-3/actions.js.bak`
- `public/whatsapp-extension/content.js` → `archive/wa-fase-3/content.js.bak`
- `public/whatsapp-extension/manifest.json` → `archive/wa-fase-3/manifest.json.bak`
- `src/components/test-extensions/WhatsAppTest.tsx` → `archive/wa-fase-3/WhatsAppTest.tsx.bak`
- `src/lib/whatsappExtensionZip.ts` → `archive/wa-fase-3/whatsappExtensionZip.ts.bak`

Più nota README `archive/wa-fase-3/README.md` con data, versione manifest di partenza (`5.10.17`) e descrizione "snapshot pre quick-win latenza WA — invio funzionante happy-path ~4s, da abbattere a <1.5s".

Reversibile in qualunque momento copiando i `.bak` sopra ai file correnti.

---

### Step 1 — Poll composer al posto di `sleep(3000)` cieco

**File:** `public/whatsapp-extension/actions.js`

Ramo URL fallback di `sendWhatsAppMessage`:
- riga ~1398: `await TabManager.sleep(3000)` → `await waitForComposerReady(tabId, 5000)`
- riga ~1432: `await TabManager.sleep(4000)` → `await waitForComposerReady(tab.id, 7000)` (cold tab)

Nuova funzione `waitForComposerReady(tabId, maxMs)` (~30 righe):
- loop ogni 150ms fino a `maxMs`
- ad ogni iterazione `chrome.scripting.executeScript` page-side che ritorna `{ composerPresent, sendBtnMounted, invalidPhonePopup }` riusando i selettori già in `_pageSendUrlFallback`
- se `invalidPhonePopup === true` → `return { ready:false, reason:"invalid_phone" }` (fail-fast: no `_pageSendUrlFallback`, errore esplicito "Numero non su WhatsApp")
- se `composerPresent === true` → `return { ready:true }`
- timeout → `return { ready:false, reason:"timeout" }`

Se `ready:false` → ritorna subito errore senza chiamare `_pageSendUrlFallback`.

**Atteso:** -2.5/-3s su happy path; fallimenti su numero invalido in <2s anziché 17s.

---

### Step 2 — Pre-ping cache UI (15s)

**File:** `src/components/test-extensions/WhatsAppTest.tsx`

In `ensureCurrentWaExtension`:
- modulo-level `lastWaPingAt: number = 0` e `lastWaPingResult: PingResult | null = null`
- se `Date.now() - lastWaPingAt < 15000` e `lastWaPingResult.success` con version OK → riusa il risultato senza nuovo `waMsg("ping")`
- ogni `waMsg("ping")` reale (manuale o implicito) aggiorna la cache
- listener modulo-level `window.addEventListener("message")` filtro `from-extension-wa` + `action: "contentScriptReady"` → `lastWaPingAt = Date.now()` (heartbeat content.js conferma vitalità)

Semantica invariata: cache stale → ping reale come oggi.

**Atteso:** -50/-300ms a invio quando l'utente clicca a raffica.

---

### Step 3 — Skip URL reload se la tab è già sul `/send?phone=` corretto

**File:** `public/whatsapp-extension/actions.js`, `sendWhatsAppMessage` ramo "tab esistente" (~1383-1406)

Prima di `chrome.tabs.update(tabId, { url: sendUrlFirst })`:
1. leggere `currentUrl = existingTabs[0].url || ""`
2. parse query: estrarre `phone` corrente
3. se `currentPhone === numericPhoneFirst` AND tab `status:complete` AND `waitForComposerReady(tabId, 1500).ready === true` → **saltare** `chrome.tabs.update` + `waitForLoad` e andare diretto a `_pageSendUrlFallback`
4. altrimenti: comportamento attuale (update + waitForComposerReady di Step 1)

Patch correlata in `_pageSendUrlFallback` (~riga 1187): cambiare check da `if (!current && messageText)` a `if (current !== messageText && messageText)` così il composer viene riallineato al nuovo testo anche se conteneva il messaggio precedente. Cambio locale, retro-compatibile.

**Atteso:** -3/-6s su invii consecutivi allo stesso numero (caso comune nei test).

---

### Step 4 — Bonifica "Unknown action" (closeActiveChat + remapSendDom)

Sintomi confermati nel terminal:
- `closeActiveChat` → `Unknown action`
- `remapSendDom` → `Unknown action: remapSendDom`

Causa unica: `content.js:26-30` ha `ALLOWED_ACTIONS` che non include i due nomi; il messaggio è bloccato dal validator nel content script prima di arrivare al background (dove `remapSendDom` invece esiste già).

**File:** `public/whatsapp-extension/content.js`

```text
ALLOWED_ACTIONS = [
  "ping","setConfig","verifySession","sendWhatsApp",
  "readUnread","learnDom","diagnosticDom","readThread",
  "backfillChat",
  + "remapSendDom",
];
```

`remapSendDom`: handler `Actions.remapSendDom` esiste già → funziona subito dopo il whitelist.

`closeActiveChat`: handler **non esiste** lato background. Scelta: **rimuovere la chiamata** in `WhatsAppTest.tsx:209-214` (con Step 1+3 il close è superfluo: Step 3 riallinea già numero/testo, Step 1 fail-fast su numero sbagliato). Niente code deadweight.

**Bump versione estensione** per forzare reinstall pulita all'utente:
- `public/whatsapp-extension/manifest.json`: `5.10.17` → `5.10.18`
- `src/lib/whatsappExtensionZip.ts`: `WHATSAPP_EXTENSION_REQUIRED_VERSION` → `5.10.18`

Senza bump l'utente continuerà a vedere "Unknown action" finché non rimuove e ricarica l'estensione.

---

### Out of scope (non in questo intervento)

- Risposta `queued:true` immediata: cambia il contratto sincrono UI ↔ extension, richiede evento asincrono affidabile, retry, gestione errori tardivi. Da valutare dopo aver misurato il guadagno di Step 1+2+3.
- Lane dedicata `sendWhatsApp` separata dal resto della coda: cambia concorrenza/ordering, più rischioso. Da valutare dopo.
- Riscrittura del ramo `_pageSendWhatsApp` (search-by-name): non sul path attuale dell'invio test.

---

### Misurazione prima/dopo

Replay attuale (06:52:15): `T+~4.0s` per `Messaggio inviato con successo`.
Target post-patch:
- invio consecutivo allo stesso numero: `< T+1.5s`
- invio nuovo numero: `< T+2.5s`
- numero invalido: `< T+2.0s` con errore esplicito (oggi 17s + popup confuso)

Verifica facendo 3 invii di test al numero fisso pinnato e leggendo i timestamp del terminale della maschera WA.

---

### File toccati (totale: 5 + 1 cartella backup)

| File | Step |
|------|------|
| `archive/wa-fase-3/*` | 0 (backup) |
| `public/whatsapp-extension/actions.js` | 1, 3 |
| `public/whatsapp-extension/content.js` | 4 |
| `public/whatsapp-extension/manifest.json` | 4 (version bump) |
| `src/components/test-extensions/WhatsAppTest.tsx` | 2, 4 (rimuove closeActiveChat) |
| `src/lib/whatsappExtensionZip.ts` | 4 (required version bump) |

Nessuna migration DB. Nessuna edge function toccata. Nessun cambio prompt o AI. Nessuna modifica alla pipeline editorial review, alla coda dispatch, a `useSendWhatsApp`, a `journalistReview`, a `log-action`. Tutto reversibile copiando i `.bak`.
