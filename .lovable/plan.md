## Problema (verificato)

I pulsanti diagnostici "🎯 CDP click" e "⌨️ Ctrl+Enter" della pagina test LinkedIn aspettano sempre ~25-30 secondi anche quando la chat è già aperta e visibile. Causa: dentro `sendMessageWithMethod` (in `public/linkedin-extension/hybrid-ops.js`) ci sono cicli di attesa pensati per "aprire da zero" il composer, che si sommano a 50+ secondi nel caso peggiore e a ~25-30s nel caso medio:

- 20 × 250ms attesa `document.readyState`
- 40 × 500ms attesa selettore `.msg-form`
- 40 × 500ms retry `findBox()` per il textbox
- 80 × 100ms retry `findSendBtn()` (solo per physical_click)
- 15 × 100ms verifica `textboxCleared`
- timeout esterno hard-coded a 25.000ms
- cooldown UI fra un test e l'altro: 5 secondi

In più la cascata CDP fa scorrere ANCHE quando il primo metodo già ha scritto il testo, perché il check `textbox_cleared` è troppo aggressivo. Risultato: l'utente preme un bottone, aspetta 30s, riprova, altri 30s. Inaccettabile per un pannello diagnostico.

WhatsApp invece scrive e clicca in <1s perché parte dal presupposto che la chat sia aperta.

## Obiettivo

Allineare il comportamento dei test LinkedIn a quello di WhatsApp: **quando l'utente preme un metodo di click, l'azione parte immediatamente sulla finestra LinkedIn già aperta**. Niente "apertura composer a freddo", niente polling da minuti, niente cooldown lunghi. Se la finestra non è pronta, fallisce subito con messaggio chiaro (≤2s) invece di tenere bloccato il pannello.

Il path produttivo `sendMessage` (cascata completa, retry, robustezza) NON viene toccato. Tocchiamo solo i pulsanti diagnostici di `/test-extensions`.

## Modifiche (UI + extension diagnostico)

### 1. `public/linkedin-extension/hybrid-ops.js` — `sendMessageWithMethod`

Trasformare la funzione in **fast-path**: presuppone che la tab LinkedIn sia attiva e il composer aperto.

- Rimuovere il loop `readyState` (5s → 0).
- Ridurre `findBox()` a max 6 × 100ms = 600ms; se non c'è, errore immediato `composer_not_open_assume_already_visible`.
- Ridurre `findSendBtn()` a max 8 × 100ms = 800ms.
- Ridurre `textboxCleared` a 8 × 75ms = 600ms (sufficiente per registrare l'invio riuscito).
- Abbassare il timeout esterno da 25.000ms a **4.000ms** per i metodi DOM (`physical_click`, `form_submit`, `keyboard_shortcut`) e a **6.000ms** per i metodi CDP (che hanno round-trip debugger).
- Per i metodi CDP, eseguire il click CDP **direttamente** senza passare prima dallo script in-page con `pending_cdp` (oggi è un round-trip extra inutile): se il composer è visibile, esegui subito `AXTree.clickSendButtonPhysical` / `AXTree.pressCtrlEnter`, poi verifica `composerCleared` con timeout 1500ms.
- Mantenere intatta la scrittura del testo (cascata paste/insertText/textContent — già veloce).

### 2. `src/components/test-extensions/LinkedInTest.tsx`

- `LI_COOLDOWN_MS`: ridurre da 5000ms a **1000ms** per i test diagnostici di click. (Non tocchiamo i cooldown del produttivo.)
- `testSendWithMethod`: timeout RPC da 90.000ms a **8.000ms**. Se scade, messaggio chiaro: "Finestra LinkedIn non pronta — assicurati che il composer sia aperto e visibile, poi ripremi".
- Aggiungere prima del test un check rapido (1s) che la tab LinkedIn esiste e ha messaging aperto; altrimenti messaggio "apri prima la chat" senza consumare il cooldown.

### 3. `public/linkedin-extension/manifest.json` + packaging

- Bump `3.9.38` → `3.9.39`, descrizione: "Diagnostic fast-path: methods run instantly on the open composer".
- Rigenerare `linkedin-extension.zip` e `linkedin-extension-3.9.39.zip`.
- Aggiornare `src/lib/whatsappExtensionZip.ts` e `public/chrome-extensions/catalog.json` (3.9.39 = current).

## Vincoli (intoccabili)

- `HybridOps.sendMessage` produttivo: NON modificare timeout, cascata o verifiche.
- WhatsApp bridge: non toccato.
- `clickMessage` scoped a `section.pv-top-card` (fix P22): preservato.
- Niente nuovi tab, niente nuovi composer, `allowCreate=false`.
- Editorial review pipeline: non toccata (riguarda produzione, non i test).
- Nessuna modifica a logica di invio reale: i test diagnostici restano diagnostici.

## Verifica post-deploy (richiesta all'utente)

1. `chrome://extensions` → rimuovi 3.9.38 → carica 3.9.39.
2. Apri una chat LinkedIn (qualsiasi profilo) e lascia il composer visibile.
3. Su `/test-extensions/linkedin` premi "🎯 CDP click" → atteso: invio o errore in **≤2s**.
4. Premi subito dopo "⌨️ Ctrl+Enter" → cooldown 1s, esegue subito.
5. Se chiudi la chat e premi un metodo: errore chiaro entro 2s ("composer non aperto").

## Dettaglio tecnico (per QA)

| Parametro | Oggi | Dopo |
|---|---|---|
| Timeout esterno DOM methods | 25.000ms | 4.000ms |
| Timeout esterno CDP methods | 25.000ms | 6.000ms |
| Loop readyState | 5.000ms | rimosso |
| Loop msg-form wait | 20.000ms | rimosso |
| Loop findBox | 20.000ms | 600ms |
| Loop findSendBtn | 8.000ms | 800ms |
| textboxCleared | 1.500ms | 600ms |
| Cooldown UI test | 5.000ms | 1.000ms |
| RPC timeout client | 90.000ms | 8.000ms |
| CDP round-trip extra | sì (pending_cdp) | no (diretto) |

Tempo atteso per click "happy path": ~300-800ms. Tempo massimo "errore composer chiuso": ~2s.

