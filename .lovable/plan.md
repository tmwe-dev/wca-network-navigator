# LinkedIn extension: auto-close composer + trim attese

## Obiettivo

Eliminare il rischio di concatenazione messaggi e ridurre di 3-4s la latenza per invio, senza toccare deduplica, verifica consegna, edge functions o WhatsApp.

## Scope

Solo `public/linkedin-extension/` + catalogo + zip. Zero modifiche a edge functions, DAL, AuthProvider, RLS, query keys, WhatsApp.

## Modifiche

### 1. Auto-close composer dopo invio confermato (Opzione C)

File: `public/linkedin-extension/hybrid-ops.js` — `sendMessageWithMethod` (≈ riga 977) e branch CDP (riga 1226-1234).

Punto di intervento: **dopo** la verifica `composerCleared = true` (cioè dopo che il messaggio è confermato partito), prima di tornare `{ success: true, ... }`:

- Iniettare uno script che cerca, dentro lo scope `.msg-overlay-conversation-bubble, [class*='msg-overlay-conversation-bubble']`, il bottone di chiusura (`button[aria-label*="Chiudi" i], button[aria-label*="Close" i], .msg-overlay-bubble-header__controls button:last-child`) e fa `.click()`.
- Wrap in try/catch: se la chiusura fallisce, **non** alterare il risultato del send (è già success). Loggare warning.
- Aggiungere campo `composer_closed: true|false` nel response per diagnostica.

La tab LinkedIn resta aperta (riusata, niente reload). Solo l'overlay del composer viene chiuso. Prossimo invio ricomincerà con composer fresco e vuoto → impossibile concatenare.

### 2. Trim attese sovradimensionate

File: `public/linkedin-extension/actions.js`

- Riga 107: `await TabManager.sleep(3000)` → `await TabManager.sleep(reused ? 800 : 2000)`. La variabile `reused` viene già da `getLinkedInTab` e indica se la tab era già caricata.
- Riga 120: `await TabManager.sleep(2500)` post-send → `await TabManager.sleep(1000)`. Il `composerCleared` interno (max 600ms) ha già verificato l'invio reale; questo sleep extra serviva solo come margine di sicurezza, riducibile.

Tutte le altre attese restano invariate (montaggio composer, gate React, polling DOM): sono effettivamente necessarie.

### 3. Versionamento e packaging

- `manifest.json`: `version` resta `3.9.56`, `version_name` → `3.9.56-autoclose`.
- Rebuild di `public/linkedin-extension.zip`.
- Nuovo zip versionato: `public/chrome-extensions/linkedin/linkedin-extension-3.9.56-autoclose.zip`.
- Aggiornare `public/chrome-extensions/catalog.json` (entry attiva).
- Aggiornare `src/lib/whatsappExtensionZip.ts` (riferimento URL/versione).

### 4. Log nel test panel

File: `src/components/test-extensions/LinkedInTest.tsx`

- Mostrare nel log testuale `composer_closed: yes/no` dal response di send, così verifichi visivamente che l'auto-close funzioni.

## File toccati

- `public/linkedin-extension/hybrid-ops.js` (auto-close + log campo)
- `public/linkedin-extension/actions.js` (2 sleep ridotti)
- `public/linkedin-extension/manifest.json` (version_name)
- `public/linkedin-extension.zip` (rebuild)
- `public/chrome-extensions/linkedin/linkedin-extension-3.9.56-autoclose.zip` (nuovo)
- `public/chrome-extensions/catalog.json`
- `src/lib/whatsappExtensionZip.ts`
- `src/components/test-extensions/LinkedInTest.tsx` (solo log)

## NON toccato

- `actions.js` send-flow logic, `background.js`, `content.js`, `tab-manager.js` (la tab persistente resta com'è)
- Le 4 strategie A/B/C/D nel test panel (restano disponibili)
- Edge functions, DAL, query keys, AuthProvider, RLS
- Estensione WhatsApp
- Editorial review, prompt, AI gateway

## Verifica post-implementazione

1. Reinstallare la zip `3.9.56-autoclose` dal catalogo.
2. Test panel → invio singolo con `cdp_ctrl_enter`: il bubble messaggi deve chiudersi automaticamente dopo l'invio. Tempo totale atteso ~5s (era ~8s).
3. Inviare un secondo messaggio dopo 5s: il composer deve riaprirsi vuoto (no concatenazione).
4. Stesso test con `physical_click`.
5. Verificare nel log che compaia `composer_closed: yes`.

Se l'auto-close fallisce su qualche layout LinkedIn, il send è comunque success: si comporta come oggi.
