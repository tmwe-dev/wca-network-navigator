
# Allineare LinkedIn al pattern WhatsApp (e recuperare il backup funzionante)

## Diagnosi

WhatsApp funziona perché segue un pattern affidabile e auto-verificato:

1. **Helper unificato `__waH`** installato una volta per tab, con `qsDeep` (deep query attraverso shadow DOM) e `modernClearAndType` con **cascata verificata**: paste ClipboardEvent → execCommand insertText → textContent + InputEvent. Dopo ogni step controlla che il testo sia davvero nel DOM. Niente duplicazioni, niente invii a vuoto.
2. **Apertura chat deterministica**: per i numeri E.164 naviga sempre a `/send?phone=…&text=…` (hard guard contro la chat sbagliata).
3. **Verifica header chat** prima di scrivere (`headerMatches`): se l'header non corrisponde al destinatario, blocca.
4. **Polling Send button** con check `aria-disabled` e fallback Enter sul composer.

LinkedIn oggi NON segue questo pattern:

- `hybrid-ops.js → sendMessage` scrive con `execCommand("insertText")` + dispatch finto di `keydown space` per "svegliare" Draft.js. Su Draft.js moderno non basta: l'EditorState resta vuoto, Send rimane `aria-disabled`, il polling scade e il testo resta orfano nella casella.
- Non c'è verifica reale tipo `hasText()` come in WA: l'estensione assume che il testo sia entrato e prosegue.
- Non c'è cascata di metodi (paste → execCommand → InputEvent) con check DOM tra uno e l'altro.
- `actions.js` corrente (post P14 "focus-safe") **non** attiva la tab e **non** chiude gli overlay precedenti. La versione di backup (`actions.primoTentativoLinkedInRiuscito.bak.js`) li chiudeva e attivava la tab → infatti funzionava, ma con doppio click (`clickMessage` + `sendMessage` che apriva un secondo overlay) → da qui il "due messaggi".

## Obiettivo

Allineare LinkedIn al pattern WhatsApp mantenendo le protezioni anti-doppio-invio già introdotte (P12 anti-double-overlay, P14 focus-safe) ma recuperando l'affidabilità del backup.

## Piano di intervento

### 1. Helper condiviso `__liH` (nuovo, su `content.js` LinkedIn)

Specchio di `__waH`, installato una volta per tab via `executeScript`. Funzioni:

- `qsDeep(sel)` / `qsaDeep(sel)` — deep query con shadow DOM (copia da WA).
- `modernClearAndType(el, text)` — **identica cascata WA** con verifica `hasText()` dopo ogni step:
  1. focus + selectAll + delete
  2. **STEP 1**: ClipboardEvent paste con `DataTransfer text/plain` (Draft.js gestisce paste nativamente e aggiorna l'EditorState)
  3. **STEP 2**: `execCommand("insertText")` se paste non ha attecchito
  4. **STEP 3**: fallback duro `textContent = text` + `InputEvent("input", { inputType:"insertText", data, composed:true })`
  5. dopo ogni step: `if (hasText()) break`

### 2. Riscrivere `hybrid-ops.js → sendMessage` Level 3 (structural fallback)

Sostituire il blocco righe 343-440 con:

- `msgBox.focus()`
- `__liH.modernClearAndType(msgBox, message)` (rimuove tutto l'attuale execCommand + dispatch finti)
- Polling Send button **identico al pattern WA** (`startSendLoop`):
  - max ~8s @ 100ms
  - check `!disabled && aria-disabled !== "true"`
  - quando abilitato → `btn.click()` + verifica `textboxCleared()` (già esiste, max 1.5s)
  - se non si svuota → fallback Ctrl+Enter (già esiste)
  - se ancora no → `success: false` con error chiaro

I livelli AX Tree e AI Learn restano invariati (sono già alternative valide quando presenti).

### 3. Recuperare le parti utili del backup `actions.primoTentativoLinkedInRiuscito.bak.js`

Riportare nel `actions.js` corrente, **senza** reintrodurre il doppio invio:

- **Activate tab + focus** prima di scrivere (`chrome.tabs.update(tab.id, { active: true })` + `ensureTabVisibleAndWait`). Il P14 focus-safe veniva da un'esigenza diversa; per il send manuale serve la tab attiva o il composer non riceve davvero input nativi.
- **Close stale overlays**: prima di cercare il composer chiude le `msg-overlay-conversation-bubble` di chat precedenti (questo evita il "wrong recipient" e il "secondo messaggio" del backup).
- **Mantenere P12 anti-double-overlay**: se esiste già un composer aperto sulla pagina target, NON cliccare di nuovo "Messaggia" (resta com'è).
- **Header verification**: prima di scrivere, leggere l'header del thread/composer (`#thread-detail h2`, `aria-label` del dialog, o nome contatto) e confrontarlo col profilo target. Se non matcha, abortire con errore esplicito (mutua dal pattern `awaitHeader` di WA, righe 1311-1322).

### 4. Allineare la fase di "ricerca address" (apertura chat)

Su WhatsApp il path E.164 è hard-coded all'URL `/send?phone=`. L'equivalente LinkedIn:

- Se `profileUrl` è già un thread (`/messaging/thread/...`) → vai diretto, salta `clickMessage` (già fatto).
- Se è un profilo `/in/...` → naviga, **chiudi overlay stale**, verifica `current URL contains slug`, poi `clickMessage` UNA volta (con guard `hasOpenComposer()`).
- Aggiungere retry SINGOLO con re-navigation se la guardia URL intercetta drift (già nel backup, è sano — solo 1 retry per evitare doppi invii).

### 5. Test e verifica

- Riprendere la maschera di test (`WhatsAppTest` + `LinkedInTest`) con destinatario fisso (già implementato).
- Test sequenza: 
  1. Send su LI con tab già aperta sul profilo → atteso: composer scritto, Send abilitato, click, textbox svuotata.
  2. Send su LI con tab su feed → atteso: navigazione + retry singolo + send.
  3. Send su thread `/messaging/thread/...` → atteso: skip clickMessage, scrivi e invia.
- Verificare che NON parta mai un doppio invio (regressione storica del backup).

## File toccati

```text
public/linkedin-extension/content.js          → installa __liH (helper condiviso, copia da WA)
public/linkedin-extension/hybrid-ops.js       → riscrive sendMessage Level 3 con __liH.modernClearAndType
public/linkedin-extension/actions.js          → re-introduce activate tab + close stale overlays + header verify
public/linkedin-extension/manifest.json       → bump versione (es. 3.9.30)
```

Nessuna modifica a edge function, DAL, UI, AI, prompt. Intervento isolato all'estensione browser (nodo critico "comunicazione esterna" → modifiche minime, locali, reversibili: la versione attuale resta come fallback in git).

## Dettagli tecnici chiave

**Perché il paste funziona dove execCommand fallisce su Draft.js**: Draft.js registra un handler `onPaste` sul root contenteditable che chiama `editor.update()` con il nuovo content tramite `Modifier.replaceText`. Questo aggiorna l'EditorState interno e di conseguenza il bottone Send viene abilitato. `execCommand("insertText")` tocca solo il DOM, non l'EditorState.

**Perché la verifica `hasText()` step-by-step**: evita doppia scrittura ("ciaociao") quando uno step ha funzionato e il successivo riapplica. È esattamente il fix che ha stabilizzato WA.

**Perché chiudere gli overlay stale**: senza chiusura, `findBox()` trova la textbox della chat fluttuante precedente (P11 antifrode + wrong recipient). Era proprio quello che generava il "due messaggi" nel backup.

## Risultato atteso

- LinkedIn manda il messaggio al primo tentativo, una volta sola, con Send realmente abilitato.
- Stesso comportamento di WhatsApp: una sola maschera, un solo click, un solo invio.
- Errori espliciti (no false positive) se composer non scrivibile o header non corrisponde.
