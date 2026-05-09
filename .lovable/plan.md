Il codice dell’estensione e lo zip sono identici al backup 3.9.48, ma la pagina test è rimasta parzialmente sulla UI/logica nuova: chiama ancora `probeComposer`, mostra le modalità composer e passa `mode` ai test diagnostici. Questo spiega l’errore `Unknown action: probeComposer`: non arriva dall’estensione backup, arriva dal chiamante rimasto fuori sync.

Piano minimo, senza toccare l’estensione 3.9.48:

1. Ripristinare la pagina test LinkedIn al comportamento coerente col backup
   - Rimuovere il pulsante “Test composer aperto” che chiama `probeComposer`.
   - Rimuovere il selettore “Modalità composer” (`background_existing_composer` / `interactive_open_composer`).
   - Rimuovere lo state `composerMode` e i testi/log legati alle modalità nuove.

2. Mantenere il pulsante principale sul path backup
   - `Invia LI` deve chiamare solo `liMsg("sendMessage", { url, message }, 90000)`.
   - Nessuna chiamata a `probeComposer` nel test principale.
   - Nessun `mode` nel payload.

3. Allineare i test diagnostici click senza cambiare il backup
   - I pulsanti diagnostici, se restano visibili, chiamano `sendMessageWithMethod` senza `mode`, come compatibile con il backup.
   - In alternativa, se interferiscono, li rendo secondari ma non tocco l’estensione.

4. Allineare metadati di download/versione
   - Lasciare `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.48"`.
   - Lasciare `catalog.json` con latest/current 3.9.48.
   - Non rigenerare né modificare i file dell’estensione, perché sono già byte-identici al backup.

5. Verifica finale
   - Cercare nel codice che non esista più nessuna chiamata app a `probeComposer`.
   - Verificare che `public/linkedin-extension.zip` resti identico a `linkedin-extension-3.9.48.zip`.
   - Verificare che la UI test non proponga più modalità nuove e che `Invia LI` usi il path backup standard.