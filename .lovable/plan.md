# Piano: Codex + Volume II in memoria, LinkedIn v3.9.42 (fix ultimo miglio)

## Parte A — Memorizzazione manuali (permanente)

1. Copio i due file in repo come fonte di verità consultabile:
   - `docs/codex/codex_quick_access.md` (la guida operativa)
   - `docs/codex/volume_II_metodo_enterprise.md` (il metodo)
2. Aggiungo due voci di memoria persistente:
   - `mem://standards/codex-cobra-protocol` → "Quando l'utente dice 'segui codex' o 'codex', applicare la checklist di `docs/codex/codex_quick_access.md`: SC:CLASSIFY → routing per intento (§2) → SC:DEFENSE/SC:ROLLBACK/SC:DATA quando attivati → SC:VERB (9 domande) → SC:ANTI → SC:CHANGELOG. Mai saltare SC:CLASSIFY. In dubbio tra due classi, scegli la superiore."
   - `mem://standards/enterprise-method-volume-ii` → "Riferimento metodo enterprise: `docs/codex/volume_II_metodo_enterprise.md`. Principio madre: prevedibilità > sofisticazione. Validare prima, costruire dopo. Atomicità: una modifica per volta, no refactor opportunistici."
3. Aggiorno `mem://index.md` (Core + sezione Memories) con i due nuovi rimandi e la regola Core: *"'segui codex' = checklist obbligatoria prima dell'esecuzione"*.

## Parte B — LinkedIn extension v3.9.42 (segui codex)

Applico SC:CLASSIFY → **STANDARD** (modifica locale a un modulo, no schema/auth/pagamenti). Tocca però comportamento osservabile critico (invio messaggi LI), quindi rispetto SC:DEFENSE + SC:ROLLBACK + ANTI.7.5 (no refactor + fix insieme).

### Rotta (SC:VERB compresso)
- **Obiettivo:** ripristinare la scrittura testo come in v3.9.40 (Selection API stabile) e completare l'**ultimo miglio**: il click sul pulsante invio nella stessa scheda già aperta dall'operatore, senza aprire nuove tab, senza cooldown lunghi.
- **Successo:** in area Test, con chat LI già aperta, premendo "DOM click" il messaggio appare scritto e inviato in <3s; nessuna nuova tab; nessun doppio invio.
- **Architettura:** `public/linkedin-extension/{actions.js, hybrid-ops.js}` only. WhatsApp invariato. `HybridOps.sendMessage` produzione invariato.
- **Raggio:** solo path diagnostico (`sendMessageWithMethod`) e writer condiviso `findBox`/`writeText`. Non tocco `clickMessage`, non tocco produzione email/WA.
- **Difesa:** input non-vuoto, timeout per metodo 8s (non 25s), nessun try/catch generico, log strategico per ogni step, nessuna nuova permission.

### Modifiche tecniche

1. **Reset baseline da v3.9.40** dei due file `actions.js` e `hybrid-ops.js` (writer Selection API funzionante).
2. **Rimuovere dal path diagnostico**:
   - `findLinkedInTabWithOpenComposer` (introdotto in 3.9.41, troppo restrittivo).
   - Ogni `chrome.tabs.update` / `ensureTabVisibleAndWait` / `clickMessage` (causa duplicazioni e attese).
   - Cooldown 5s tra metodi → ridotto a 800ms (test manuale, non produzione).
3. **Tab targeting semplice:** usare la **tab attiva corrente** della finestra LinkedIn (`chrome.tabs.query({active:true, url:"*://www.linkedin.com/*"})`); fallback alla prima LI tab. Nessuna scansione/scoring.
4. **Composer detection robusta** (mantenuta da 3.9.41): `findBox` con `deepQueryAll` su `[contenteditable='true'], [role='textbox']` dentro `.msg-form, [role='dialog']`.
5. **Ultimo miglio (click invio)** — questo è il pezzo nuovo che mancava in 3.9.40:
   - Dopo il write, attesa breve (250ms) per abilitazione bottone.
   - Selezione bottone: `button.msg-form__send-button:not([disabled])` con fallback `button[type='submit']:not([disabled])` dentro `.msg-form`.
   - Invio per metodo selezionato dall'utente:
     - `dom_click`: `btn.click()` diretto.
     - `cdp_physical_click`: invariato ma su `btn` trovato (non più sul composer).
     - `keyboard_shortcut`: dispatch `keydown` Ctrl+Enter sull'input + fallback `form.requestSubmit()`.
     - `form_submit`: `btn.closest('form').requestSubmit(btn)`.
   - Verifica post-invio: il composer si svuota entro 1.5s → success; altrimenti `send_button_no_effect`.
6. **Anti-doppio invio:** flag `__lvSending` su window per 2s; secondo trigger nello stesso intervallo → no-op con log.

### Versione & packaging
- Bump a **3.9.42** in `manifest.json`, `whatsappExtensionZip.ts`, `catalog.json`.
- Rigenero `linkedin-extension-3.9.42.zip` e `public/linkedin-extension.zip`.

### SC:ROLLBACK
- File toccati: 4 (`actions.js`, `hybrid-ops.js`, `manifest.json`, `whatsappExtensionZip.ts`, `catalog.json`).
- Rollback: l'utente carica `linkedin-extension-3.9.40.zip` (presente in `public/chrome-extensions/linkedin/`). Nessun effetto irreversibile (solo client-side).
- Soglia: se al primo test manuale dopo install si verifica doppio invio o nuova tab → STOP, rollback a 3.9.40.

### SC:ANTI check
- ANTI.7.1 fallback silenziosi: ogni metodo ritorna errore tipizzato, mai swallow.
- ANTI.7.3 ottimizzazioni copiate: nessuna.
- ANTI.7.5 refactor + fix: solo fix, nessun refactor.

### Out of scope (non tocco)
- WhatsApp extension, edge functions, DB, auth, RLS, produzione outreach, `HybridOps.sendMessage`, `clickMessage`.

## Consegna attesa
Istruzioni utente: rimuovi v3.9.41, carica **3.9.42** unpacked, apri una chat LI manualmente, in area Test premi "DOM click" → deve scrivere e inviare nella stessa tab in <3s.