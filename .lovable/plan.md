# Piano implementazione v3.9.38

## Obiettivo
Eliminare la regressione "non scrive il testo" rimuovendo definitivamente l'AX/AI writer dal percorso di invio produzione e rendendo il DOM writer deterministico con errori diagnostici chiari. Ridurre rumore log WhatsApp DOM learning.

## Modifiche

### 1. `public/linkedin-extension/hybrid-ops.js` — `HybridOps.sendMessage`
- Rimuovere ogni residuo di `AILearn.typeMessageWithSchema` / `AXTree.typeMessage` dal percorso produttivo. AX usato solo per diagnostica passiva (read-only), mai per scrivere.
- Sequenza unica deterministica:
  1. `clickMessage` (già scoped al `section.pv-top-card`)
  2. Localizza composer (`div.msg-form__contenteditable[contenteditable="true"]`)
  3. `focus()` → svuota (`select all + delete`) → `execCommand('insertText', false, text)` con fallback `InputEvent` paste-like
  4. **Verifica testuale**: `composer.textContent.trim() === text.trim()` → se no, errore `text_not_committed_to_composer` con dump diagnostico (innerHTML length, focus state)
  5. **Verifica Send button**: trova bottone `button.msg-form__send-button:not([disabled])` → se disabilitato dopo 800ms, errore `send_button_not_enabled_after_write`
  6. CDP physical click sul Send button; fallback Ctrl/Cmd+Enter solo se click CDP fallisce
- Commento esplicito in testa alla funzione: politica "single writer, no AX in production".

### 2. `src/hooks/useWhatsAppDomLearning.ts`
- `learn()` catch: passare da `log.error("learning error", {message})` a `log.warn("learning skipped", {reason, isAvailable, hasResult})` con diagnostica strutturata (motivo: timeout, no schema, extension unreachable). Non blocca, non rumoreggia in console come errore.

### 3. Versione e packaging
- `public/linkedin-extension/manifest.json` → `"version": "3.9.38"`, descrizione aggiornata.
- Rigenerare `public/linkedin-extension.zip` e `public/chrome-extensions/linkedin/linkedin-extension-3.9.38.zip` con `nix run nixpkgs#zip`.
- `src/lib/whatsappExtensionZip.ts` e `public/chrome-extensions/catalog.json`: 3.9.38 = current, 3.9.37 = inactive.
- Validare manifest JSON parse prima di zippare.

## Vincoli (intoccabili)
- No nuove tab LinkedIn (`allowCreate=false` ovunque).
- No nuovi composer.
- Bridge WhatsApp non toccato.
- `clickMessage` resta scoped al `section.pv-top-card` (fix P22 v3.9.37 preservato).
- `readThread`/`backfillThread` con `isProfileUrl=false` resta (fix P22 v3.9.37 preservato).
- Nessuna scorciatoia di invio se la verifica testuale fallisce: errore esplicito, mai invio "alla cieca".

## Verifica post-deploy (richiesta all'utente)
1. `chrome://extensions` → rimuovi 3.9.37 → carica 3.9.38.
2. Test sequenza: Leggi thread → Backfill → Invio "test12".
3. Conferma: testo presente nel composer + Send button attivo + 1 sola tab LinkedIn + 1 solo overlay.
