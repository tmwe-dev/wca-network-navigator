## Premessa: cosa dicono i dati (verificato adesso sul DB)

Capisco il dubbio. Ti mostro i numeri esatti prima di proporre qualunque cosa, perché incidono sulla scelta.

Tabella `channel_messages`, canale email, casella personale (`mailbox_id IS NULL`):

| Operatore | Righe fisiche | message_id distinti | Prima riga | Ultima riga |
|---|---|---|---|---|
| Luca | 4.985 | 4.985 | 03-04-2026 | 15-05-2026 |
| Luigi | 2.539 | 2.539 | 07-04-2026 | 15-05-2026 |
| Imane | 2.630 | 2.630 | 10-04-2026 | 15-05-2026 |

Quelle 2.539 righe di Luigi e 2.630 di Imane **non sono una "vista" sulle tue email**: sono righe fisiche separate, con `operator_id = Luigi/Imane`, `user_id = Luigi/Imane`, scaricate via IMAP nei giorni in cui loro hanno cliccato "Scarica posta". Sono nate perché `check-inbox`, in mancanza di credenziali IMAP personali su `operators`, è caduto sui secret globali `IMAP_USER/IMAP_PASSWORD` = `luca@tmwe.it` e ha salvato il risultato sotto l'operatore che aveva premuto il pulsante.

Quindi il problema è duplice e va separato:

1. **Sorgente** — oggi Luigi/Imane, se cliccano "Scarica", riscaricano ancora la tua casella. Questo va fermato a monte.
2. **Storico** — esistono già 5.169 righe duplicate sotto i loro account. Senza toccarle, Luigi continuerà a vedere "le sue email" che in realtà sono le tue.

## Cosa propongo (zero DELETE)

Rispetto la tua regola: **non cancello niente**. Te le presento come opzioni separate da approvare.

### Parte A — Blocco a monte (obbligatoria, indolore)

Modifica a `supabase/functions/check-inbox/index.ts`:

- Se l'operatore non ha `imap_user`/`imap_password_encrypted` propri **e** non passa `x-mailbox-id` (cioè non ha selezionato una casella condivisa come Booking), la funzione risponde 403 con messaggio chiaro ("Nessuna casella personale configurata, seleziona Booking").
- Niente più fallback ai secret globali per operatori diversi da Luca.
- Luca continua a funzionare identico.
- Luigi/Imane potranno scaricare solo da Booking (header `x-mailbox-id` impostato dal `MailboxSelector`).

Effetto: da subito **nessuna nuova email tua finisce nelle loro inbox personali**.

### Parte B — Storico esistente (scegli tu, niente DELETE)

Le 5.169 righe già duplicate sotto Luigi/Imane restano lì o le isoliamo. Tre opzioni, tutte **senza cancellare**:

- **B1. Lasciare tutto com'è.** Luigi e Imane continueranno a vedere quelle 2.539/2.630 email come "loro inbox personale" perché le righe sono fisicamente loro. Onesto ma confuso.
- **B2. Nascondere via flag (consigliata).** UPDATE su quelle righe impostando `hidden_by_rule = true` (campo già esistente sulla tabella) + `folder = 'archived_legacy'`. Le inbox di Luigi/Imane si svuotano, i dati restano integri e recuperabili con una query, nessuna riga viene rimossa.
- **B3. Riassegnazione.** UPDATE `operator_id`/`user_id` di quelle 5.169 righe a Luca. I dati confluiscono nella tua inbox (dove esistono già copie tue → potrebbero diventare doppioni visibili a te). Più invasivo.

La mia raccomandazione è **A + B2**: blocchiamo la sorgente e nascondiamo lo storico con un flag, senza perdere un byte.

### Parte C — Categorie/gruppi/prompt condivisi vs email personali

Hai ragione: la condivisione deve fermarsi a metadati e regole, non al contenuto delle email.

Verifico (in lettura, senza modificare niente) e ti riporto se serve toccare RLS:

- `email_sender_groups` / `email_address_rules` / `operative_prompts`: confermare se sono già condivisi a livello workspace o per `user_id`. Se sono per `user_id`, rendiamo condivisibili **solo gruppo + categoria + prompt associato**, mai le righe di `channel_messages`.
- `channel_messages`: la RLS resta strettamente per `user_id`/`operator_id`, mai cross-operatore.

Per la Parte C nessuna modifica viene proposta finché non ho letto le policy attuali e te le mostro: se sono già a posto, non tocco nulla.

## Riepilogo decisionale per te

1. Confermi **Parte A** (blocco `check-inbox` per chi non ha credenziali proprie, fallback globale solo per Luca)?
2. Per lo **storico** (Parte B): preferisci **B1 lasciare**, **B2 nascondere con flag** (consigliata), o **B3 riassegnare a Luca**?
3. Vuoi che proceda anche con l'audit RLS della **Parte C** in lettura per dirti se serve davvero toccare qualcosa?

Nessuna riga verrà toccata finché non rispondi su 1 e 2.
