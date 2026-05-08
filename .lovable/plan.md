## Obiettivo

Garantire che, dopo aver scritto il messaggio nel composer LinkedIn, l'estensione invii davvero il messaggio. Oggi il click esiste ma può fallire silenziosamente in due casi:
1. Il bottone "Invia" rimane disabilitato perché Draft.js non riceve l'evento giusto.
2. Il polling di 3 secondi scade prima che LinkedIn abiliti il bottone.

## Cosa cambio (solo `public/linkedin-extension/hybrid-ops.js`, funzione `sendMessage` → fallback Level 3)

1. **Forzo Draft.js a riconoscere l'input.** Subito dopo `execCommand("insertText")`, dispatch in sequenza di:
   - `InputEvent("input", { inputType: "insertText", data: msg, bubbles: true })`
   - `KeyboardEvent("keydown" / "keyup", { key: " ", bubbles: true })` (un finto carattere innocuo che spesso "sveglia" lo state)
   - `Event("change", { bubbles: true })`
   Questo è l'unico modo affidabile per far abilitare il bottone Send su Draft.js quando `execCommand` da solo non basta.

2. **Polling più lungo e con verifica esplicita "abilitato".** Da 30×100ms (3s) a 80×100ms (8s), e a ogni iterazione controllo `!btn.disabled && btn.getAttribute("aria-disabled") !== "true"`.

3. **Fallback finale: invio da tastiera.** Se dopo 8s il bottone Send non è abilitato MA la textbox contiene il testo atteso, simulo `Ctrl+Enter` sulla textbox (shortcut nativo LinkedIn per inviare). È l'ultima rete di sicurezza.

4. **Verifica post-click.** Dopo il click (o il Ctrl+Enter), aspetto 1.5s e controllo che la textbox sia vuota (sign che il messaggio è partito davvero). Se è ancora piena, ritorno `{ success: false, error: "send_clicked_but_textbox_not_cleared" }` invece di un falso `success: true`. Così non diciamo più "inviato" senza esserne sicuri.

## Cosa NON tocco

- `clickMessage` e il guard anti-double-overlay (3.9.22) restano invariati.
- Niente refactor su AX Tree o AI Learn (Level 1 e 2): il fix è chirurgico sul Level 3, l'unico fallback che oggi è in uso reale.
- Niente modifiche lato app (UI/test/DAL).

## Versione e packaging

- Manifest: `3.9.22` → `3.9.23`.
- Note catalog: "P13 — Garanzia invio: dispatch eventi per Draft.js, polling Send esteso a 8s, fallback Ctrl+Enter, verifica post-click che la textbox si sia svuotata."
- Ricreo `linkedin-extension-3.9.23.zip` in `public/chrome-extensions/linkedin/` e aggiorno `public/linkedin-extension.zip` (latest) e `catalog.json`.

## Verifica attesa dopo l'install

Test su Gianfranco:
- Apre **una sola** chat (guard 3.9.22 già attivo).
- Scrive il testo.
- Vedi il bottone Invia abilitarsi entro 1-3 secondi.
- Click parte automaticamente, la textbox si svuota → ritorno `success: true, method: "structural_fallback"`.
- Se per qualunque motivo il click non funziona, scatta il Ctrl+Enter; se nemmeno quello svuota la textbox, ricevi un errore esplicito invece di un falso "ok".
