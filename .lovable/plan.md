# Patch ibrida LinkedIn Extension — base 3.9.48

Obiettivo: scrivere testo, cliccare Send, non rubare focus, non aprire nuove tab, non duplicare. Eliminare la certificazione eccessiva del post-click che fa fallire invii andati a buon fine. Mantenere le protezioni moderne (anti-double-send, scope composer, hard guards URL).

Base: `3.9.48` (no rollback). Versione target: `3.9.49`.

## File toccati

- `public/linkedin-extension/hybrid-ops.js` — riscrittura sezione post-click in `sendMessage` + cleanup overlay stale + anti-double-send.
- `public/linkedin-extension/tab-manager.js` — `getLinkedInTab` con preferenza match URL esatto.
- `public/linkedin-extension/manifest.json` — bump versione `3.9.48` → `3.9.49`.
- `public/chrome-extensions/catalog.json` — entry `linkedin/3.9.49`, `latest` e `current` aggiornati.
- `public/chrome-extensions/linkedin/linkedin-extension-3.9.49.zip` — nuovo bundle.
- `public/linkedin-extension.zip` — rigenerato.
- `src/lib/whatsappExtensionZip.ts` — `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.49"`.

Nessun cambio a UI/test page, DAL, edge functions, DB, o pipeline AI.

## Modifica chirurgica `hybrid-ops.js` (single change-area, righe ~470–582)

1. **Anti-double-send modulo** (in cima al file, prima di `sendMessage`):
   - Mappa in `chrome.storage.session` (fallback in-memory): `{ tabId+urlPath+msgHash → timestamp }`.
   - Prima di scrivere, rifiuta con `success:false, error:"anti_double_send_2s"` se ultimo invio identico < 2000ms.
   - Dopo click, registra il timestamp.

2. **Cleanup overlay stale** (dentro l'IIFE injected, subito dopo `findBox()`):
   - Enumera `.msg-overlay-conversation-bubble`, `.msg-overlay-conversation-bubble--minimized`, `[class*='msg-overlay-conversation']` visibili.
   - Identifica il composer "target" come quello che contiene `msgBox` (closest).
   - Per ciascun overlay non-target, clicca `[aria-label*='Chiudi'], [aria-label*='Close'], button.msg-overlay-bubble-header__control` se presente; altrimenti skip (no force-remove DOM).
   - Mai chiudere il `.msg-form` target, mai chiudere il composer della pagina profilo.

3. **Sostituire blocco righe 514–561** con click ottimistico:
   ```text
   sendBtn = polling 8s (invariato)
   if (!sendBtn) return { success:false, error:"send_button_not_found" }
   if (sendBtn.disabled || aria-disabled) return { success:false, error:"send_button_disabled" }
   firePhysicalClick(sendBtn)  // unica azione di invio
   registerAntiDouble(...)
   // verifica soft, non-bloccante
   const cleared = await textboxCleared()  // 1.5s polling come oggi
   if (cleared) return { success:true, method:"physical_click", verified:true }
   return {
     success:true, method:"physical_click", verified:false,
     warning:"textbox_not_cleared_after_click_unverified"
   }
   ```
   - **Rimuovere** chiamate a `submitComposer()`, `Ctrl/Cmd+Enter` synthetic, e (sotto) i fallback `AXTree.clickSendButtonPhysical` / `AXTree.pressCtrlEnter` quando il physical click DOM ha avuto luogo su bottone enabled. Mantenerli SOLO quando `sendBtn` non era trovato/abilitato (gestito dai due `error` ritornati prima → niente fallback CDP automatico per evitare doppio invio).
   - `submitComposer`, `textboxCleared`, `firePhysicalClick` restano definiti (ancora usati da `sendMessageWithMethod` diagnostico, righe 776–1023, da non toccare).

4. **No focus stealing / no new tab**: nessuna chiamata a `chrome.tabs.update(tabId, { active: true })`, `chrome.windows.update(..., { focused: true })`, o `chrome.tabs.create` viene aggiunta. Verificare che la patch non introduca regressioni in tal senso (nessuna esiste oggi nel path `sendMessage`).

## Modifica `tab-manager.js` `getLinkedInTab` (righe 163–250)

Aggiungere uno step PRIMA del primo `chrome.tabs.query` generico:

```text
1. Se `url` è valorizzato:
   - query `*://*.linkedin.com/*`
   - filtra `urlMatchesTarget(t.url, url)` (path identico)
   - se trovato: reuse senza navigate, ritorna { id, reused:true, exactMatch:true }
2. Altrimenti: comportamento attuale (prima tab LinkedIn generica).
```

Nessun cambio agli altri rami (cached owned, automation window, allowCreate).

## Versionamento e packaging

- `manifest.json` → `"version": "3.9.49"`.
- Rigenerare ZIP con `nix run nixpkgs#zip` da `public/linkedin-extension/`, output sia in `public/linkedin-extension.zip` che `public/chrome-extensions/linkedin/linkedin-extension-3.9.49.zip`.
- `catalog.json`: aggiungere entry `3.9.49` con changelog "Click ottimistico post-Send + cleanup overlay stale + tab targeting esatto + anti-double-send 2s", aggiornare `latest` e `current`.
- `whatsappExtensionZip.ts`: `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.49"`.

## Cosa NON viene toccato

- `actions.js` (1515 righe): nessuna modifica. Hard guards `wrong_recipient`, anti-double-send a livello action, `composerAlreadyOpen` restano invariati.
- `sendMessageWithMethod` (diagnostico, righe 767–1023): invariato.
- Test UI `LinkedInTest.tsx`: invariato.
- AX Tree / AILearn / config / popup / background: invariati.

## Comportamento atteso post-patch

| Scenario | Risultato |
|---|---|
| Send button trovato + enabled, textbox si svuota | `success:true, verified:true` |
| Send button trovato + enabled, textbox NON si svuota in 1.5s | `success:true, verified:false, warning:"textbox_not_cleared_after_click_unverified"` |
| Send button non trovato in 8s | `success:false, error:"send_button_not_found"` (no fallback CDP) |
| Send button disabled | `success:false, error:"send_button_disabled"` |
| Stesso messaggio identico < 2s sulla stessa tab+path | `success:false, error:"anti_double_send_2s"` |
| Due overlay flottanti aperti, profilo target distinto | Overlay non-target chiusi via bottone close, composer target preservato |
| Tab aperta su URL profilo target esatto | Reuse di quella tab, no navigate |

## Verifica finale

- Grep: nessun nuovo `tabs.update.*active:.*true` o `windows.update.*focused` aggiunto.
- Grep: `submitComposer\|pressCtrlEnter\|clickSendButtonPhysical` in `sendMessage` (NON `sendMessageWithMethod`) → 0 occorrenze nel path principale dopo patch.
- Diff vs 3.9.48 limitato a 3 file (`hybrid-ops.js`, `tab-manager.js`, `manifest.json`) + zip + catalog + costante client.
- Smoke su `/v2/test-extensions` LinkedIn: pulsante "Invia LI" deve completare con `verified:true` su profilo pulito, `verified:false + warning` su profilo che lascia testo residuo, `anti_double_send_2s` se ricliccato entro 2s.
