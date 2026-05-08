## Obiettivo

Quando WhatsApp/LinkedIn cambiano DOM e l'invio si rompe (come ora con `chat-list-search` → `chat-list-search-container`), un click di un bottone fa rianalizzare la pagina dall'AI, salva i nuovi selettori e riprende a funzionare. Niente redeploy, niente attesa.

## Architettura

```text
[UI tasto "Rimappa DOM invio"]
   │
   ▼
[extension background] → snapshot DOM della pagina WA/LI
   │
   ▼
[optimus-analyze edge fn] page_type="send_form" → restituisce JSON selettori
   │
   ▼
[chrome.storage.local] salva {searchBox, chatItem, composer, sendButton, chatHeader, savedAt, domHash}
   │
   ▼
[invio successivo] _pageSendWhatsApp legge i selettori cachati → li prova PRIMA di quelli hardcoded → se falliscono ricade sui hardcoded → in caso di fallimento totale, toast UI "Selettori invio scaduti, premi Rimappa DOM"
```

## Modifiche puntuali

### 1. Edge function `supabase/functions/optimus-analyze/index.ts`

- Aggiungere `"send_form"` all'allowlist `page_type` (oggi: sidebar/thread/inbox/messaging).
- Aggiungere `channelGuidance("whatsapp","send_form")` e `("linkedin","send_form")` che chiede esattamente questi 5 campi: `search_box`, `chat_item`, `composer`, `send_button`, `chat_header`. Per ognuno: `primary` + `fallback` selettore CSS robusto, preferendo `data-testid` / `role` / `aria-label` / `contenteditable`.
- Constraint upsert `(operator_id,channel,page_type)` già copre il nuovo valore.

### 2. WhatsApp extension

**`public/whatsapp-extension/background.js`**: nuovo handler messaggio `"remap-send-dom"`:
- attiva tab WA, snapshot via `Optimus.snapshotPage()`,
- chiama `Optimus.getPlan({channel:"whatsapp", pageType:"send_form", snapshot, hash})`,
- valida che plan contenga i 5 campi minimi (search_box+composer+send_button obbligatori),
- `chrome.storage.local.set({wa_send_plan:{plan, savedAt, domHash}})`,
- ritorna `{success, fields, savedAt}` per la UI.

**`public/whatsapp-extension/actions.js`** in `sendWhatsAppMessage`:
- prima di `executeScript`, leggi `wa_send_plan` dallo storage,
- passa `cachedPlan` come arg a `_pageSendWhatsApp(target, message, cachedPlan)`,
- in `_pageSendWhatsApp` la sequenza diventa: per ogni elemento (searchBox/composer/sendBtn) prova `cachedPlan.<field>.primary`, poi `.fallback`, poi catena hardcoded esistente. Identico per `_pageOpenChatForBackfill`.
- se l'invio fallisce con uno dei `*not found`, ritorna error + flag `needsRemap:true` così la UI mostra un toast "Premi Rimappa DOM".

### 3. LinkedIn extension

Stesso identico pattern in `public/linkedin-extension/{background.js,actions.js}` con chiave storage `li_send_plan` e fields `search_box`, `conversation_item`, `composer`, `send_button`, `recipient_header`.

### 4. UI — pannello Test estensioni

`src/components/test-extensions/WhatsAppTest.tsx` e `LinkedInTest.tsx`:
- nuovo bottone **🔧 Rimappa DOM invio** in cima al pannello azioni,
- mostra spinner + log dei 5 selettori restituiti dall'AI + timestamp + dom-hash,
- toast verde se tutti e 5 trovati, toast giallo se mancano `chat_header` o `chat_item`, toast rosso se mancano i 3 obbligatori.
- (Opzionale ma utile) badge "Plan salvato 2 min fa" sul bottone, da `chrome.storage.local`.

### 5. Bump versione + zip

- WA: `5.10.2 → 5.10.3`, manifest+background+catalog+`whatsappExtensionZip.ts`+nuova zip.
- LI: `3.9.2 → 3.9.3`, idem.

## Garanzie

- **Mai sostituire i selettori hardcoded**: il piano cachato è solo un overlay che viene provato per primo. Se vuoto/scaduto/invalido, comportamento attuale invariato.
- **Validazione hard**: il plan AI passa solo se contiene i 3 campi obbligatori. Niente plan parziali in cache.
- **Niente auto-retry AI sotto banco**: se l'invio fallisce, NON richiama Optimus da solo. Toast → utente preme "Rimappa DOM" → controllo umano. È esattamente quello che hai chiesto.
- **Editorial review intatto**: il messaggio è già passato dal review prima di arrivare a `sendWhatsAppMessage`. Questo modulo è solo trasporto, non genera testo.

## Fuori scope (per non gonfiare)

- Lettura messaggi (`readUnread`) già usa Optimus, non si tocca.
- Auto-relearn periodico/cron: no, hai chiesto manuale.
- Notifica proattiva "il DOM è cambiato": no, hai detto "se mi accorgo io o se ne accorge il sistema (= invio fallisce)".

## Rischio

Medio-basso. Tocca `_pageSendWhatsApp`/`_pageSendLinkedIn` (nodi critici) ma SOLO aggiungendo un layer prima dei selettori esistenti. In caso il plan AI sia spazzatura, fallback identico a oggi.

## QA finale

1. Reinstalla WA 5.10.3 + LI 3.9.3.
2. Senza Rimappa: invio funziona (selettori hardcoded già aggiornati a 5.10.2).
3. Premi "🔧 Rimappa DOM invio (WA)" → log mostra 5 selettori → invio a "Jose Programmatore Cuba" → success.
4. Stessa cosa LI verso un profilo test.
5. Simula rottura: in DevTools cambia il `data-testid` della search WA → invio fallisce con `needsRemap:true` → click Rimappa → invio riparte.
