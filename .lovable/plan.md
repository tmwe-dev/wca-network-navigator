## Problema

Nel test estensioni → WhatsApp, il messaggio finisce nella **prima chat trovata** invece che al destinatario indicato. Cause concomitanti:

1. **Il form ha solo "Nome contatto"**, niente numero. Quando inserisci "Gianfranco" la extension cade nella branch search-based (`_pageSendWhatsApp`) perché `isPhoneNumber` è false.
2. **La search-based send non verifica l'header** della chat aperta dopo il click: se la search non aggiorna in tempo (Lexical lento) o trova un titolo che "include" il target tra più contatti, viene usata la chat sbagliata o quella già aperta.
3. La hard-guard introdotta in 5.10.15 funziona **solo se viene passato un numero** — e oggi dal form non c'è modo di passarlo.

## Cosa cambio (solo i punti minimi necessari)

### 1. `src/components/test-extensions/WhatsAppTest.tsx` — UI test
- Aggiungere un campo dedicato **"Numero (E.164, es. +393331234567)"** *prima* del campo nome.
- `testSendMessage`: se il numero è valorizzato → passa `phone: numero` (path hard-guard URL). Altrimenti usa il nome come oggi.
- Mantenere il `closeActiveChat` esistente per i cambi destinatario nel flusso "per nome".
- Mostrare nel terminal quale path verrà usato (`URL diretto` vs `Search per nome`).

### 2. `public/whatsapp-extension/actions.js` — `_pageSendWhatsApp` (path search)
Aggiungere **verifica header chat** prima di scrivere nel composer:
- Dopo il click sul candidato, attendere fino a 2.5s che `#main header span[title]` (o `[data-testid="conversation-header"] span[title]`) contenga davvero il `target` (case-insensitive, normalizzato).
- Se l'header non corrisponde → `resolve({ success: false, error: "Header chat non corrisponde a <target>", needsRemap: false })` **senza** scrivere nel composer (no invio sbagliato).
- Inoltre: **scegliere il match migliore**, non il primo. Se più chat hanno titolo che include il target, preferire match esatto (lowercased equals) rispetto a substring; in mancanza di esatto, scartare match ambigui (più di un candidato substring) e ritornare errore.

### 3. Version bump WhatsApp `5.10.15 → 5.10.16`
- `public/whatsapp-extension/manifest.json`
- `src/lib/whatsappExtensionZip.ts` (costante `WHATSAPP_EXTENSION_REQUIRED_VERSION`)
- `public/chrome-extensions/catalog.json`
- Ricostruzione `public/whatsapp-extension.zip` + `public/chrome-extensions/whatsapp/whatsapp-extension-5.10.16.zip`

## Cosa NON tocco

- `tab-manager.js`, `verifySession`, `readUnread`, Optimus, sync-guard, hooks di invio in produzione (`useSendWhatsApp`/orchestratori): l'invio prod usa già `phone` E.164 dal CRM, quindi la hard-guard URL già lo copre.
- Niente refactor di `sendWhatsAppMessage`. Solo il path search guadagna il check header.

## Risultato atteso

- Inserendo il numero E.164 nel test → invio garantito al destinatario via URL `/send?phone=...`, nessuna possibilità di finire sulla chat attiva.
- Inserendo solo il nome → se l'header non matcha dopo il click, l'invio viene **bloccato con errore esplicito** invece di scrivere nella chat sbagliata.
