# Riparazione LinkedIn Test — versione + destinatario

Due fix chirurgici, uno alla volta, entrambi reversibili. Nessun refactor, nessun tocco a WhatsApp né alla pipeline outreach.

---

## Fix 1 — Allineare la versione richiesta a quella installata (3.9.42)

**Sintomo**: l'app ti chiede di installare l'estensione LinkedIn anche se quella che hai già in Chrome (`3.9.42`) funziona e invia.

**Causa**: in `src/lib/whatsappExtensionZip.ts` la costante `LINKEDIN_EXTENSION_REQUIRED_VERSION` è impostata a `"3.9.44"`. Tutta la UI (banner test, download button, settings) confronta la versione attiva con questa costante → mismatch → "installa la nuova".

**Modifica unica**:
- `src/lib/whatsappExtensionZip.ts` riga 9: cambio `"3.9.44"` → `"3.9.42"`.

Lo ZIP `linkedin-extension-3.9.42.zip` è già presente in `public/chrome-extensions/linkedin/` e nel `catalog.json`, quindi il pulsante "Scarica estensioni" continua a funzionare. Le versioni 3.9.43 e 3.9.44 restano in catalogo come storia.

**Rollback**: una riga, riportare a `"3.9.44"`.

---

## Fix 2 — Bloccare l'invio LinkedIn alla chat sbagliata

**Sintomo**: il messaggio parte sempre verso la prima conversazione che incontra, ignorando il destinatario `linkedin.com/in/<slug>`.

**Causa identificata** in `public/linkedin-extension/actions.js` righe 87-96:

```text
const onTarget = (current URL contiene /in/<slug>)
const onThread = (current URL combacia /messaging/thread/...)
if (!onTarget && !onThread) → errore "wrong_recipient"
```

Il `|| onThread` è il bug: se la tab LinkedIn riusata è già su **una qualsiasi** thread (es. l'ultima conversazione che l'utente aveva aperto), il check passa e il composer invia lì, anche se non è il destinatario richiesto.

A monte, `tab-manager.js` `getLinkedInTab(url, false, false)` riusa la tab utente e fa `chrome.tabs.update(tabId, { url: targetProfileUrl })` (righe 182, 201, 223, 247): la navigazione c'è, ma se il caricamento è ancora in corso o LinkedIn fa una redirect interna verso `/messaging/thread/...`, il check `onThread` chiude un occhio e si invia.

**Modifica unica e localizzata**:
- `public/linkedin-extension/actions.js`: rimuovo il ramo `onThread` come scorciatoia di validazione. La guardia diventa: **si invia solo se l'URL corrente contiene `/in/<slug-target>`**, altrimenti `wrong_recipient` e nessun click. È la regola che già usavamo nei test e impedisce qualsiasi invio "alla cieca".
- Nessun cambio a `tab-manager.js`, nessun cambio al composer, nessun cambio al backend.

**Cautela aggiuntiva** (zero rischio): nel ramo che riusa la tab utente già su LinkedIn, forzo sempre il `chrome.tabs.update(..., { url: targetProfileUrl })` quando l'URL corrente non contiene già `/in/<slug>`. È il comportamento già attuale, lo rendiamo solo esplicito con un log per debug.

**Versioning estensione**: il fix richiede ricostruire lo ZIP. Strategia conservativa concordata con la tua richiesta "non rompere il codice":
- **NON** bumpiamo a 3.9.45 (perderemmo il match con la 3.9.42 che hai installata).
- Sovrascriviamo i sorgenti `public/linkedin-extension/actions.js` e bumpiamo il `manifest.json` interno della **3.9.42** patch a `3.9.42` invariato. **Tu non devi reinstallare niente** se non vuoi: il fix di destinatario serve solo quando ricostruisci lo ZIP e lo reinstalli. Per ora la 3.9.42 installata continua col bug del destinatario, ma il sistema **smette di chiederti di aggiornare** (Fix 1).

**Decisione che ti chiedo dopo l'approvazione del piano**: dopo Fix 1, vuoi che (a) ricostruiamo lo ZIP `3.9.42` con il fix destinatario e tu lo reinstalli una volta sola, oppure (b) lasciamo stare l'estensione e testiamo il fix destinatario solo quando deciderai di aggiornare?

**Rollback Fix 2**: ripristinare la riga `|| onThread` in `actions.js`.

---

## Cosa NON tocco (per non rompere)

- Nessuna modifica a `src/components/test-extensions/LinkedInTest.tsx` (la UI test).
- Nessuna modifica al codice WhatsApp (estensione, hook, edge function).
- Nessuna modifica a outreach, holding pattern, scoring, Funnemail.
- Nessuna migrazione DB.
- Nessuna nuova memoria scritta finché i due fix non sono verificati live.

---

## Ordine di esecuzione (atomico, un fix alla volta)

1. Applico Fix 1.
2. Tu ricarichi la pagina test e confermi che il banner "installa estensione" è sparito.
3. Solo dopo conferma, applico Fix 2 e ti chiedo se rigenerare lo ZIP.
