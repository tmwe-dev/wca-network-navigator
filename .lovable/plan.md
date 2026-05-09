## Dove stai lavorando tu

Sei sulla pagina **`/test-extensions` → tab LinkedIn**, hai cliccato il bottone **"Invia LI"** (test veloce). Niente di sbagliato da parte tua: è il test che oggi presuppone che la chat LinkedIn sia già aperta nella tab Chrome.

## Cosa succede oggi (perché vedi `composer_not_open`)

Il bottone "Invia LI" chiama l'estensione con `sendMessageWithMethod`. Il flusso interno:

1. Naviga la tab LinkedIn al profilo `/in/<slug>` in **background** (focus-safe, non porta la tab in primo piano).
2. Aspetta solo **1,2 s** (`ensureTabVisibleAndWait`).
3. Cerca il bottone "Messaggia" (`clickMessage`) — su pagina profilo pesante e in tab background spesso non è ancora montato.
4. Se non lo trova, esce con `open_composer_failed` o, se il click va ma la textbox non monta entro 4 s, esce con `composer_not_open`.

Inoltre il timeout lato webapp è **12 s**, troppo stretto per: navigate + render profilo + click + polling composer.

L'invio reale di outreach funziona perché parte da contesti dove la pagina è già caldda; il test diagnostico no.

## Cosa propongo (modifica minima, reversibile, isolata al test)

Tutte le modifiche restano dentro `public/linkedin-extension/actions.js` (funzione `sendLinkedInMessageWithMethod`) e nel bridge della pagina test. Nessun tocco a `sendLinkedInMessage` (usato dall'outreach reale) → niente rischi sul flusso che già funziona.

### Cambiamenti

1. **Attesa di "ready" del profilo prima di cercare il bottone Messaggia**
   - Dopo `ensureTabVisibleAndWait`, polling fino a 6 s (intervalli 300 ms) finché in pagina non compare il bottone `"Messaggia"` (`button[aria-label*='essag' i]` su scope profilo) **oppure** un composer già aperto.
   - Se scade: messaggio chiaro `profile_not_ready: profilo LinkedIn non ancora pronto in background, riprova` (così l'utente sa che non è colpa sua).

2. **Click + retry del bottone Messaggia**
   - Se il primo `HybridOps.clickMessage` fallisce, attesa 1,5 s e secondo tentativo. Stop al secondo fallimento.

3. **Polling composer più lungo**
   - Da 4 s (16×250 ms) a 8 s (32×250 ms) dopo il click. La textbox a volte monta tardi su tab scrollata in background.

4. **Timeout bridge lato webapp**
   - In `src/components/test-extensions/LinkedInTest.tsx`, alzare il timeout di `liMsg("sendMessageWithMethod", …)` del test veloce da **12 000 ms → 30 000 ms**, allineato al test "isolato" già a 20 s + margine. Stessa modifica solo sul bottone "Invia LI"; gli altri test restano invariati.

5. **Log più parlanti nel terminale del test**
   - In caso di fallimento aggiungere log riga separata: `❌ profile_not_ready` / `❌ open_composer_failed` / `❌ composer_not_open` con il suggerimento concreto (es. "tieni la tab LinkedIn aperta su qualsiasi pagina, anche feed").

### Cosa NON tocco

- `sendLinkedInMessage` (usato dall'invio reale outreach).
- Hard guard destinatario (`wrong_recipient`) — resta attivo.
- Versione estensione (`3.9.44`) — nessuna richiesta all'utente di reinstallare.
- Nessun cambio a `TabManager`, `HybridOps`, manifest, permessi.

### Verifica dopo il deploy

1. Tu, dalla pagina `/test-extensions`, premi solo **"Invia LI"** col profilo Gianfranco preimpostato.
2. La tab LinkedIn può essere su feed/inbox/qualunque profilo: l'estensione naviga, aspetta che il profilo sia pronto, clicca "Messaggia" e invia.
3. Se la pagina è davvero non pronta (es. LinkedIn ti chiede captcha), vedi un errore esplicito invece del generico `composer_not_open`.

### Atomicità

È **una sola modifica funzionale** (rendere il test veloce auto-aperto), divisa in 5 ritocchi piccoli sullo stesso percorso (`sendLinkedInMessageWithMethod` + un timeout nel componente test). Nessun refactor, nessun side-effect su outreach, sync, AI o DB.

## File toccati

- `public/linkedin-extension/actions.js` — solo `sendLinkedInMessageWithMethod`.
- `src/components/test-extensions/LinkedInTest.tsx` — solo il timeout del bottone "Invia LI" e i log di errore.
- ZIP estensione **non** ricostruito: la versione resta 3.9.44, ma il file `actions.js` cambia → serve **un solo "Ricarica" dell'estensione** in `chrome://extensions` (no rimuovi/reinstalla, basta il pulsante reload sulla card).
