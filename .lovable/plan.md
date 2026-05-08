## LinkedIn Patch Kit — Piano di applicazione

Obiettivo: portare il punteggio LinkedIn da 40k a 82k risolvendo i 10 problemi identificati nell'audit, senza rompere email/WhatsApp/holding pattern. Versione estensione passerà a **3.9.20**.

### Fase 1 — Decisione architetturale + Auth (priorità MAX)

**Decisione**: separare invio singolo (bridge diretto, no coda) da invio bulk/scheduled (coda con consumer).

1. **send-linkedin/index.ts**
   - Mantenere validazione, rate limit, journalist review.
   - Per invio singolo: NON inserire in `extension_dispatch_queue`, ritornare `{ approved: true, finalMessage, recipient }`.
   - Mantenere insert in coda solo per richieste con flag `bulk: true` o `scheduled_for` futuro.
   - Nuovo endpoint `mark-linkedin-sent` per aggiornare stato post-invio bridge.

2. **Patch 6 — Auth check** (taglia metà dei fail silenziosi):
   - `LinkedInDMDialog.handleSend`: chiamare `ensureAuthenticated(0)` prima dell'invio.
   - `useSendLinkedIn.handleSendLinkedIn`: idem.
   - `useLinkedInMessagingBridge.sendMessage`: idem all'inizio.
   - Toast "LinkedIn non autenticato" se fallisce, zero tentativi successivi.

### Fase 2 — Fix critici estensione

3. **Patch 1 — Thread URL detection** (`actions.js::sendLinkedInMessage`):
   - Se URL contiene `/messaging/thread/` → SKIP `clickMessage`, vai diretto a `sendMessage`.
   - Altrimenti (profile `/in/...`) → `clickMessage` poi `sendMessage`.
   - Aggiungere `chrome.tabs.update(tabId, { active: true })` + attesa focus prima di scrivere (risolve P9).

4. **Patch 2 — Disable AX Tree per clickMessage** (`hybrid-ops.js::clickMessage`):
   - Rimuovere il blocco `AXTree.clickMessageButton` (clicca la navbar globale).
   - Lasciare solo il fallback strutturale che filtra dentro `<main>`.

### Fase 3 — Robustezza DOM

5. **Patch 3 — Textbox scoped** (`hybrid-ops.js::sendMessage::findBox`):
   - Cercare `[role=textbox][contenteditable=true]` SOLO dentro `.msg-form`, `[role=dialog]`, o `.msg-overlay-conversation-bubble`.
   - Mai search bar / filtri.

6. **Patch 4 — Send button robusto** (`hybrid-ops.js::sendMessage::findSendButton`):
   - Match per: classe `msg-form__send-button`, `aria-label*="Send"|"Invia"`, `type=submit` dentro `.msg-form`.
   - Escludere `disabled` e `aria-disabled="true"`.
   - Solo dentro composer, non bottoni globali.

7. **Patch 5 — Scrittura via execCommand** (`hybrid-ops.js::sendMessage`):
   - Sostituire `appendChild(createTextNode)` con: `box.focus()` → `document.execCommand('selectAll')` → `document.execCommand('insertText', false, msg)`.
   - Garantisce che React/Draft.js aggiorni lo state interno e abiliti il bottone Send.

8. **Patch 7 — Timeout 120s**:
   - `useLinkedInMessagingBridge.sendMessage`: timeout `120000` (era 90000, kit chiede 120).
   - `useLinkedInExtensionBridge`: stessi timeout per `sendMessage`/`sendConnectionRequest`.
   - `extensionBridge.ts::liMsg`: `sendMessage` → 120000.

### Fase 4 — Consumer coda per bulk

9. **Patch 8 — DispatchQueue con chrome.alarms**:
   - Nuovo file `public/linkedin-extension/dispatch-queue.js`: poller via `chrome.alarms.create("li-dispatch", {periodInMinutes: 0.5})`.
   - In `background.js`: registrare alarm + listener `onAlarm` che chiama `claim-linkedin-dispatch`.
   - 3 nuove edge functions:
     - `claim-linkedin-dispatch`: SELECT + UPDATE atomico con `FOR UPDATE SKIP LOCKED`.
     - `complete-linkedin-dispatch`: `status='sent', sent_at=NOW()`.
     - `fail-linkedin-dispatch`: incrementa `retry_count`; se <3 ripianifica +5 min, altrimenti `failed`.
   - Aggiungere a `manifest.json` permission `alarms`.

### Versioning + ZIP

- Bump `manifest.json`, `catalog.json`, `whatsappExtensionZip.ts` → **3.9.20**.
- Rebuild `public/linkedin-extension.zip` + `public/chrome-extensions/linkedin/linkedin-extension-3.9.20.zip`.

### File toccati (riepilogo)

```text
public/linkedin-extension/actions.js          (P1)
public/linkedin-extension/hybrid-ops.js       (P2, P3, P4, P5)
public/linkedin-extension/dispatch-queue.js   (NEW, P8)
public/linkedin-extension/background.js       (P8 hookup)
public/linkedin-extension/manifest.json       (alarms perm + version)
src/hooks/useLinkedInMessagingBridge.ts       (P6, P7)
src/hooks/useSendLinkedIn.ts                  (P6)
src/components/.../LinkedInDMDialog.tsx       (P6)
src/components/test-extensions/extensionBridge.ts (P7)
src/lib/whatsappExtensionZip.ts               (versione)
public/chrome-extensions/catalog.json         (versione)
supabase/functions/send-linkedin/index.ts     (Decisione Arch)
supabase/functions/mark-linkedin-sent/        (NEW)
supabase/functions/claim-linkedin-dispatch/   (NEW, P8)
supabase/functions/complete-linkedin-dispatch/(NEW, P8)
supabase/functions/fail-linkedin-dispatch/    (NEW, P8)
```

### Conferme richieste prima di partire

1. **Vincolo memoria**: la memoria "Editorial Review obbligatorio" è rispettata (journalist review resta dentro `send-linkedin`, anche per invio singolo che ora passa SEMPRE da lì). OK?
2. **Bulk consumer**: confermi che vuoi anche le 3 edge functions nuove + permission `alarms`, oppure preferisci spostare la Fase 4 in un secondo step?
3. **`mark-linkedin-sent`**: nuovo endpoint o riutilizzo di un RPC esistente per registrare `status='sent'`?
