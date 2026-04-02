
Diagnosi chirurgica della procedura email

1. Cosa ho verificato
- `supabase/functions/check-inbox/index.ts`
- `src/components/outreach/EmailInboxView.tsx`
- `src/hooks/useChannelMessages.ts`
- dati reali salvati in `channel_messages`
- log reali della funzione `check-inbox`

2. Il problema vero del body
Il body c’è, ma viene salvato e mostrato male.

Perché:
- il backend scarica sezioni MIME (`bodyParts`) e le tratta come testo già pronto
- poi usa `TextDecoder()` direttamente, senza decodificare davvero il contenuto email
- non gestisce correttamente `base64` e `quoted-printable`
- in più, in alcuni casi salva pezzi sbagliati del MIME invece del contenuto reale

Risultato concreto:
- vedi stringhe tipo `SG9sYS...==` = body ancora in base64
- vedi `=3D`, `=20` = quoted-printable non decodificato
- vedi `BODY[1.2] {27}` = wrapper/protocollo IMAP finito nel body
- vedi `--_000...` e header `Content-Type:` = boundary MIME/container, non testo finale
- a volte finisce HTML grezzo dentro `body_text`

3. Perché si vede “di merda” a schermo
Il frontend oggi mostra solo `body_text`.

In `EmailInboxView.tsx` il dettaglio usa:
- `selectedMsg.body_text || "(corpo vuoto)"`

Quindi:
- se il backend salva HTML in `body_html`, l’interfaccia non lo usa
- se il backend mette HTML dentro `body_text`, tu lo vedi come testo sporco
- se il backend salva base64 o boundary MIME, tu vedi esattamente quella sporcizia

Quindi il problema è sia di estrazione backend sia di rendering frontend.

4. Perché alcune mail risultano “Sconosciuto”
Ci sono due casi distinti.

Caso A: mittente visualizzato come `Sconosciuto`
- succede quando `raw_payload.sender_name` e `from_address` sono vuoti
- questo non vuol dire che la mail non abbia mittente
- vuol dire che il parser non è riuscito a estrarlo

La causa precisa è qui:
- la funzione fa un fetch unico con `envelope + bodyStructure`
- se il parsing di `bodyStructure` fallisce, salta anche l’`envelope`
- quando questo succede, il codice continua con `envelope = {}`
- quindi salva:
  - `from_address` vuoto
  - `subject` vuoto
  - `date` vuota
  - `sender_name` vuoto
  - `message_id_external` di fallback tipo `uid_...`

Questo è confermato dai log:
- `ImapParseError: Invalid body structure format`
- errore su messaggi MIME complessi, ad esempio con `message/rfc822` allegato `.eml`

Nel database ho trovato:
- 8 email con `from_address` vuoto

Caso B: `source_type = "unknown"`
- questo non significa “mittente sconosciuto”
- significa solo “email non associata a partner/contatto/prospect nel database interno”

Quindi:
- una mail può avere mittente perfettamente letto
- ma essere comunque `source_type = unknown` perché non matcha nessun record interno

Al momento, sulle 20 email recenti:
- tutte hanno `source_type = 'unknown'`

Questo è un problema di matching CRM, non di ricezione email.

5. Errore architetturale principale
Il punto più fragile è questo:
- `client.fetch(... { envelope: true, bodyStructure: true })`

Perché:
- stai legando i dati “semplici” del messaggio (mittente, oggetto, data)
- a una parte molto fragile (parsing MIME/bodyStructure)

Quindi un errore sul MIME ti rompe anche mittente, subject e date.

6. Problemi collaterali emersi
Ne sono usciti altri due, importanti:

- Data/ora in lista falsata:
  - la funzione non salva la data reale del messaggio in `created_at`
  - la mette solo in `raw_payload.date`
  - quindi la UI ordina/mostra l’ora di import, non quella reale della mail
  - per questo molte email risultano tutte con la stessa ora

- Fallback troppo aggressivo:
  - se non trova `text/plain` o `text/html`, il codice prende “qualunque part disponibile”
  - questo spiega perché spesso finisce nel DB un boundary MIME o un blocco tecnico invece del contenuto leggibile

7. Evidenze raccolte
Dai dati reali:
- 8 email con `from_address` vuoto
- 10 email con subject vuoto o `(nessun oggetto)`
- 2 email con body che inizia con `BODY[...]`
- 4 email con body che inizia con boundary MIME `--_...`
- 1 email con HTML salvato dentro `body_text`
- 8 email con `body_html` presente, ma non usato dalla UI

Dai log reali:
- errori `ImapParseError: Invalid body structure format`
- errore su MIME complessi / allegati `.eml`

8. Sintesi finale
Il body non manca.
Il body viene:
- estratto in modo fragile
- salvato spesso nel formato sbagliato
- mostrato dal frontend nel campo sbagliato

E i “mittenti sconosciuti” non sono davvero sconosciuti:
- in alcuni casi il parser ha perso l’envelope
- negli altri casi `unknown` vuol dire solo “non associato ai tuoi contatti interni”

Dettagli tecnici
- Backend critico: `supabase/functions/check-inbox/index.ts`
  - fetch envelope/bodyStructure: circa righe `281-286`
  - parsing body sections: circa righe `337-379`
  - salvataggio messaggio: circa righe `390-405`
- Frontend critico: `src/components/outreach/EmailInboxView.tsx`
  - lista mittente: `raw_payload?.sender_name || from_address || "Sconosciuto"`
  - dettaglio body: mostra solo `body_text`

Se vuoi, il passo successivo giusto non è “rifare tutto”, ma fare una correzione chirurgica in 3 punti:
1. separare envelope e body fetch
2. decodificare davvero il contenuto MIME
3. far rendere `body_html` quando presente
