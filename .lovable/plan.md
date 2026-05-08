Obiettivo: impedire che LinkedIn/WhatsApp usino la tab o chat già attiva come destinatario, e far rispettare sempre il campo compilato nella maschera Test Estensioni.

Piano di intervento minimo:

1. LinkedIn: isolamento tab per destinatario
- In `public/linkedin-extension/tab-manager.js`, modificare la logica di riuso tab: se arriva un URL profilo preciso come `https://www.linkedin.com/in/gianfranco-cristiano-12513434/`, non deve “adottare” una tab LinkedIn già aperta e restare sulla pagina attiva.
- Deve riusare solo una tab già allineata allo stesso profilo, oppure navigare esplicitamente al target ricevuto.
- Dopo la navigazione, verificare che l’URL corrente corrisponda al profilo richiesto prima di cliccare “Messaggia”. Se non corrisponde, bloccare l’invio con errore chiaro.

2. LinkedIn: guardia anti-destinatario sbagliato
- In `public/linkedin-extension/actions.js` / `hybrid-ops.js`, aggiungere un controllo pre-send: il composer può essere usato solo se la tab è ancora sul profilo/thread aperto dal target richiesto.
- Mantenere il click finale non forzato/già prudente: se il composer non è sicuramente del destinatario corretto, fallisce invece di inviare.

3. WhatsApp: usare sempre il campo del test
- In `public/whatsapp-extension/actions.js`, cambiare `sendWhatsAppMessage(phone, text)` per non tentare prima l’invio search-based sulla chat corrente quando `phone` è un numero.
- Se il campo contiene un numero valido, usare subito `https://web.whatsapp.com/send?phone=...&text=...`, anche se esiste già una tab WhatsApp aperta.
- Solo se il campo non è un numero, usare la ricerca contatto nella sidebar.

4. WhatsApp: rimuovere falsa chiusura chat
- La maschera `WhatsAppTest.tsx` prova a chiamare `closeActiveChat`, ma l’estensione non espone quell’azione: oggi è un no-op mascherato.
- Sostituire questa dipendenza con log chiaro e comportamento deterministico lato estensione: nuovo destinatario numerico = nuova URL send, non chat corrente.

5. Versioni e pacchetti
- Incrementare le versioni estensioni: LinkedIn `3.9.21`, WhatsApp `5.10.15`.
- Aggiornare manifest, catalogo e costanti richieste in `src/lib/whatsappExtensionZip.ts`.
- Rigenerare gli zip statici e i fallback `public/linkedin-extension.zip` / `public/whatsapp-extension.zip`.

6. Verifica
- Controllare che il payload dalla maschera contenga il destinatario inserito.
- Verificare staticamente che LinkedIn non possa riusare una pagina attiva diversa da Gianfranco.
- Verificare staticamente che WhatsApp con numero usi sempre URL `/send?phone=<numero>` e non la chat aperta precedente.

File previsti:
- `public/linkedin-extension/tab-manager.js`
- `public/linkedin-extension/actions.js`
- `public/linkedin-extension/manifest.json`
- `public/whatsapp-extension/actions.js`
- `public/whatsapp-extension/manifest.json`
- `src/components/test-extensions/WhatsAppTest.tsx` solo per log/UX, senza cambiare logica app
- `src/lib/whatsappExtensionZip.ts`
- `public/chrome-extensions/catalog.json`
- zip estensioni in `public/chrome-extensions/...` e fallback in `public/`