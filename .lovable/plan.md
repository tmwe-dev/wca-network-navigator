## Verifica logica attuale

Il problema è confermato: nel test WhatsApp l’elenco “Seleziona contatto” non arriva dal database.

Oggi succede questo:

```text
Leggi Messaggi → estensione legge la sidebar WhatsApp → estrae solo nome chat + ora
Dropdown test → usa solo c.contact
Invia WA → manda quel nome come campo phone
Estensione → se non è un numero, cerca quel nome nella sidebar WhatsApp
```

Quindi l’elenco è “cieco”: non contiene telefono, id contatto, origine CRM, né collegamento al record reale. Per “Gianfranco” sta cercando una stringa dentro WhatsApp Web, non il Gianfranco del CRM.

Ho verificato anche i dati reali: nel database esiste il contatto corretto:

```text
imported_contacts
nome: gianfranco cristiano / transport management srl
phone/mobile: +393341987225
email: gianfranco@tmwe.it
```

Ci sono anche altri “Gianfranco”, quindi il solo nome è ambiguo e non deve essere usato per inviare.

## Mappa impatto

Nodo critico: invio WhatsApp.

Cosa fa oggi:
- il test può inviare per numero diretto oppure per nome chat;
- il path per numero usa `/send?phone=...` ed è quello più sicuro;
- il path per nome dipende dalla sidebar WhatsApp ed è fragile/ambiguo.

Cosa non va toccato:
- orchestratori di produzione;
- coda outreach;
- backfill/sync WhatsApp;
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen`;
- logica di invio email/AI/editorial review.

## Piano di intervento minimo

1. Separare chiaramente due liste nel test WhatsApp:
   - “Chat lette da WhatsApp Web” = diagnostica, solo nomi chat, non affidabile per invio;
   - “Destinatari dal database” = lista reale con nome, azienda, telefono/mobile, sorgente.

2. Aggiungere una ricerca database nel test:
   - campo ricerca nome/azienda/email/telefono;
   - lookup su `imported_contacts`, `partner_contacts`, `partners`, `business_cards`;
   - mostrare solo record con telefono/mobile usabile come destinatari primari;
   - evidenziare record senza telefono come “non inviabile”.

3. Quando selezioni un destinatario dal database:
   - compilare automaticamente il numero E.164 nel campo numero;
   - l’invio usa sempre il path diretto `/send?phone=...`;
   - nel terminal mostrare sorgente, nome, azienda e numero scelto.

4. Bloccare il path ambiguo per nome nel test, oppure tenerlo solo come fallback diagnostico esplicito:
   - se manca il numero, non inviare automaticamente;
   - mostrare errore: “serve un numero, il nome chat non garantisce il destinatario”.

5. Sistemare il bridge test dove serve:
   - il content script oggi non permette alcune azioni già presenti nella UI (`remapSendDom`, `closeActiveChat`), quindi vanno allineate le action consentite;
   - non cambiare il flusso produzione, solo la pagina Test Estensioni e il manifest/zip WhatsApp.

6. Version bump WhatsApp:
   - `5.10.17 → 5.10.18`;
   - aggiornare catalogo e ZIP.

## Risultato atteso

Nel test, cercando “Gianfranco” vedrai il record reale con `+393341987225`; selezionandolo, il messaggio partirà via numero diretto e non tramite ricerca nome nella sidebar WhatsApp.