## Pulizia confusione "Operativo": gruppo mittenti vs cartella destinazione

### Ho capito la differenza
Ci sono **due piani distinti** che oggi sono mescolati:

1. **Gruppo mittente** (`email_sender_groups`) → "Chi è chi mi scrive": Clienti, Fornitori, Banca, WCA, ADS, ecc.
2. **Cartella destinazione FunneMail** (`funnemail_folders`) → "Dove finisce questa email per essere lavorata": RFQ, Operations, Tasks, Support, Internal, Alerts, Info, Newsletter, Spam, ecc.

Una mail di un **CLIENTI** (gruppo) può finire in **RFQ** se chiede preventivo, in **Operations** se è una pratica in corso, in **Tasks** se contesta una fattura, in **Support** se ha un problema. Mai e poi mai dovrebbe finire in una cartella chiamata "Clienti" o "Operativo" — quelle non sono destinazioni, sono attributi del mittente.

### Stato attuale (verificato)
- In `email_sender_groups` esiste un gruppo `Operativo` con descrizione "Email operative quotidiane" (id `ed627c10-…`). **È un'invasione**: usa il vocabolario delle destinazioni FunneMail per classificare il mittente. Non ha senso, perché "operativo" non descrive chi scrive ma cosa va fatto con la mail.
- Il gruppo `Operativo` ha 3 regole `email_address_rules` collegate (vanno spostate, non eliminate).
- In `funnemail_folders` la `section='operative'` è corretta e va lasciata: contiene RFQ, Operations, Tasks, Support, Internal, Alerts, Info, Other_urgent. Quelle sono destinazioni reali della pipeline FunneMail.
- Riferimenti hardcoded a `"operativo"` come gruppo: `supabase/functions/_shared/textUtils.ts` (lista placeholder generica) — non collegato al gruppo specifico.

### Cosa faccio

**1) Rimuovo il gruppo mittenti `Operativo`**
- Sposto le 3 regole esistenti su un gruppo neutro (proposta: `CLIENTI` se i mittenti sono clienti, oppure creo un nuovo gruppo `Generico` se non identificabili). Ti chiedo prima di muovere quei 3 indirizzi: te li mostro e decidi tu dove metterli.
- DELETE del gruppo `Operativo` da `email_sender_groups` (soft-delete via trigger).

**2) Documento la separazione concettuale**
- Aggiungo nota in KB (`public/kb-source/email.md` se esiste, altrimenti aggiorno `glossario.md`):
  - **Gruppo mittente** = identità del mittente (Clienti, Fornitori, Banca, …). Non descrive cosa fare.
  - **Cartella FunneMail** = destinazione operativa (RFQ, Tasks, Support, …). Determinata dal contenuto, non dal mittente.
  - Vietato creare gruppi mittenti con nomi di azione/destinazione (Operativo, Tasks, Da_lavorare, Urgente, ecc.).

**3) Guard preventiva**
- Aggiungo trigger DB su `email_sender_groups` BEFORE INSERT/UPDATE che rifiuta nomi che collidono con label/slug di `funnemail_folders` (case-insensitive): `operativo`, `operations`, `rfq`, `tasks`, `support`, `internal`, `alerts`, `newsletter`, `spam`, `archive`, `to_sort`, `info`, `other_urgent`. Errore esplicito: "Il nome '<x>' è una destinazione FunneMail, non un gruppo mittente. Rinomina."
- Pulizia della lista placeholder in `supabase/functions/_shared/textUtils.ts` rimuovendo "operativo" dall'elenco di esempio (è un placeholder testuale, low-impact).

**4) UI — etichette chiare**
- Nel form "Crea gruppo mittenti" (Email Intelligence) aggiungo helper text: *"Inserisci CHI scrive (es. Clienti, Banca, Fornitori). Non usare nomi di azione: per quelli ci sono le cartelle FunneMail."*
- Nessun cambio funzionale al routing FunneMail (resta intatto).

### Cosa NON tocco
- `funnemail_folders.section='operative'` resta com'è — è la sezione corretta di destinazioni.
- Logica di classificazione FunneMail (`funnemail-classify`, prompt `funnemail_classifier`) intatta.
- Edge functions di invio/classificazione email intatte.
- Auth utente intatta.

### Domanda prima di procedere
Le 3 regole `email_address_rules` collegate al gruppo `Operativo`: te le mostro e mi dici dove riassegnarle (CLIENTI? FORNITORI? altro gruppo esistente? nuovo gruppo neutro `Generico`?), oppure preferisci che le sposti automaticamente in un nuovo gruppo `Generico` da bonificare manualmente dopo?