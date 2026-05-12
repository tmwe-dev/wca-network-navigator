## Diagnosi: perché Booking, Iman e Luigi non si scaricano da soli

Il cron `email_cron_sync_tick` gira ogni 15 minuti e chiama `email-cron-sync`. Ho letto il codice e i dati: il problema è in **tre livelli sovrapposti**.

### 1) Il cron sincronizza solo le caselle PERSONALI, mai quelle CONDIVISE

`email-cron-sync` fa questa query:

```ts
.from("email_sync_state").select("user_id").limit(10)
```

Prende solo `user_id`, **scarta `mailbox_id`**, e poi chiama `check-inbox` con header `x-sync-user-id` ma **senza** `x-mailbox-id`. Dentro `check-inbox`:

```ts
const requestedMailboxId = req.headers.get("x-mailbox-id"); // null
// → sincronizza la casella personale (mailbox_id IS NULL) di quell'utente
```

Risultato in DB (`email_sync_state` reale, ora):

| user_id | mailbox_id | last_sync_at |
|---|---|---|
| Luca | **Booking** (`31e5…`) | 12 mag 11:24 (manuale, da te) |
| Luca | NULL (personale) | 5 mag 13:04 |
| altri 5 utenti | NULL (personale) | varie date |
| chiunque | **Amministrazione** (`ac81…`) | **mai** |

Il cron, anche girando, non chiama mai Booking né Amministrazione: itera 10 record di `email_sync_state` ma li tratta tutti come "personale" perché non passa `mailbox_id`.

### 2) Le caselle condivise non hanno una "subscription" automatica

`shared_mailboxes` contiene Booking e Amministrazione (entrambe `is_active=true`). Ma il cron **non legge mai** `shared_mailboxes`: non esiste la regola "per ogni casella condivisa attiva, sincronizzala". Booking ha un record in `email_sync_state` solo perché TU hai premuto "Scarica" almeno una volta selezionandola dal dropdown.

### 3) Le caselle personali di Iman/Luigi appaiono solo dopo il primo download manuale

Per le caselle personali non esiste una tabella di credenziali IMAP separata: il record in `email_sync_state` viene creato **solo** quando l'utente preme "Scarica" la prima volta da loggato. Se Iman e Luigi non hanno mai sincronizzato dalla loro sessione, il cron non sa nemmeno che esistono.

---

## Cosa va cambiato

### A. Rendere il cron mailbox-aware

`email-cron-sync` deve iterare per **(user_id, mailbox_id)** invece che per solo user_id, e propagare l'header `x-mailbox-id` a `check-inbox`.

Diff concettuale:

```ts
// PRIMA
.from("email_sync_state").select("user_id").limit(10)
// chiamata: header x-sync-user-id

// DOPO
.from("email_sync_state").select("user_id, mailbox_id, last_sync_at").limit(50)
// chiamata: header x-sync-user-id + x-mailbox-id (se non null)
```

### B. Auto-iscrivere le caselle CONDIVISE attive

All'inizio di ogni tick, oltre a leggere `email_sync_state`, leggere `shared_mailboxes` con `is_active=true AND deleted_at IS NULL` e fare `upsert` su `email_sync_state` per ogni coppia (operator_with_access, mailbox_id) mancante. Così Booking e Amministrazione finiscono nel pool del cron senza richiedere un click umano.

Per scegliere "quale user_id assegniamo alla mailbox condivisa": basta uno qualsiasi degli operatori con accesso (`operator_mailbox_access`). La sincronizzazione tecnica usa le credenziali di `shared_mailboxes` (imap_host/user/password_encrypted), non quelle dell'operatore.

### C. Auto-iscrivere le caselle PERSONALI degli operatori attivi

Per Iman, Luigi, e chiunque non abbia mai cliccato "Scarica":
- Al login, l'app fa già l'`upsert` di `email_sync_state` (mailbox_id=NULL) la prima volta che monta `useContinuousSync` → da verificare/forzare. Se non lo fa, il cron continuerà a saltarli.
- In alternativa (più robusto): il cron legge `profiles` per trovare gli operatori attivi e fa `upsert` mailbox personale come per le condivise.

### D. Aumentare il pool e il rate

Oggi: `limit(10)` ogni 15 min = al massimo 40 sync/ora. Con 2 caselle condivise + N personali questo è già al limite. Suggerito: `limit(50)` + cron a `*/10` o `*/5` minuti.

### E. Frequenza

Cambiare schedule del job 45 da `*/15 * * * *` a `*/10 * * * *` (o `*/5` se vogliamo essere più reattivi).

---

## Cosa non cambia

- `check-inbox` stesso (è già mailbox-aware via `x-mailbox-id`).
- Le credenziali IMAP delle caselle condivise (già in `shared_mailboxes`).
- Work-hours guard (resta attivo per non sincronizzare di notte).
- Cron guard / rate limit (`cron_email_sync_enabled`, `cron_email_sync_interval_min`).
- Nessuna modifica a UI, CRM, regole/gruppi.

## Risposta breve da dare all'utente

> Oggi il cron sincronizza solo la **casella personale** dell'utente che ha già fatto almeno un download manuale. Le caselle **condivise** (Booking, Amministrazione) e le caselle personali di chi non ha mai sincronizzato (Iman, Luigi) non vengono mai pescate dal cron, perché:
> 1. il cron non legge `shared_mailboxes`,
> 2. e non passa l'header `x-mailbox-id` a `check-inbox`.
>
> Si fixa con A+B+C: rendere il cron mailbox-aware, auto-iscrivere tutte le caselle condivise attive, e auto-iscrivere le personali degli operatori attivi. A quel punto Booking/Amm/Iman/Luigi si scaricano da sole ogni 10-15 min.

---

## Rischio

Basso. Il cambio è confinato a `email-cron-sync` (edge function isolato, già con guard, work-hours e logging). `check-inbox` resta intoccato (memoria: codice protetto). Nessuna migrazione DB necessaria.
