Ripristiniamo il comportamento del backup che apriva il composer e scriveva, senza introdurre modalità nuove o logiche diverse.

## Obiettivo
- Tornare alla pipeline backup LinkedIn che funzionava: naviga focus-safe al profilo, clicca `Messaggia`, aspetta il composer, scrive nel box.
- Correggere solo il problema noto del backup: doppia scrittura/doppio invio.
- Non mantenere la logica recente `background_existing_composer` / `interactive_open_composer` come percorso principale.

## Piano operativo
1. **Base di ripristino**
   - Usare come sorgente il backup disponibile in archivio, preferibilmente `linkedin-extension-3.9.48.zip`, perché è l’ultimo backup prima del refactor a due modalità e contiene ancora la pipeline che apriva e scriveva.
   - Ripristinare i file dell’estensione da quel backup: `actions.js`, `hybrid-ops.js`, `background.js`, `content.js`, `tab-manager.js`, `manifest.json` e gli altri file inclusi nello ZIP.

2. **Fix minimo sul doppio comportamento**
   - Aggiungere una guardia anti-doppio invio già all’ingresso di `sendLinkedInMessage`: stessa coppia `url + message` entro una finestra breve viene bloccata.
   - Nel writer, evitare che più fallback scrivano lo stesso testo due volte: ogni fallback parte solo se il testo non è già presente nel composer.
   - Non cambiare la strategia di apertura composer: resta quella del backup.

3. **Ripristino UI test coerente**
   - Rimuovere dalla UI test LinkedIn le modalità nuove se interferiscono con il flusso.
   - Il bottone “Invia LinkedIn” deve chiamare il percorso backup standard, non il nuovo percorso a modalità.
   - Eventuali diagnostiche restano secondarie e non devono modificare il comportamento dell’invio reale.

4. **Versione e pacchetto**
   - Creare una nuova versione, ad esempio `3.9.53`, descritta chiaramente come “restore backup pipeline + anti double write”.
   - Aggiornare `LINKEDIN_EXTENSION_REQUIRED_VERSION`, `catalog.json` e rigenerare:
     - `public/linkedin-extension.zip`
     - `public/chrome-extensions/linkedin/linkedin-extension-3.9.53.zip`

5. **Verifica tecnica prima di consegnare**
   - Controllare nello ZIP finale che il manifest sia `3.9.53`.
   - Controllare che `actions.js` contenga la pipeline backup e non il percorso primario a due modalità.
   - Controllare che la guardia anti-duplicato sia presente.
   - Nessuna modifica a database, inbox, WhatsApp, email, Partner Connect o altre estensioni.

## Cosa NON faccio
- Non reinvento il flusso LinkedIn.
- Non aggiungo nuove modalità operative.
- Non tocco backend, database, inbox, email o WhatsApp.
- Non riscrivo architettura: ripristino backup + fix locale sul doppio write.