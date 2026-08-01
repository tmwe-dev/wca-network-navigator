---
name: Email cron sync — loop di drenaggio arretrato
description: email-cron-sync chiama check-inbox in loop (budget 50s, cap 40/casella) perché BATCH_SIZE=1 lasciava le caselle con arretrato perennemente indietro
type: feature
---
# Causa (audit 2026-06-20)
`check-inbox` ha `CHECK_INBOX_BATCH_SIZE=1` (default conservativo per CPU edge):
processa UNA sola UID per invocazione. `email-cron-sync` (cron ogni 10 min)
chiamava check-inbox UNA volta per casella → max 1 email/run per casella.

Sintomo: la casella **Personale** (mailbox_id NULL, luca@tmwe.it) era ferma al
1 giugno (UID 107201) con ~1000+ email di arretrato; drenava ~1 email/20 min e
non recuperava mai. La casella **booking** sembrava sana solo perché già a regime
(poche nuove al giorno). Le email recenti esistevano in DB ma sotto mailbox_id
booking, non visibili nella vista "Personale".

# Correzione
`email-cron-sync` ora richiama `check-inbox` in **loop** per ogni casella finché
la response indica `has_more === true`, entro:
- budget globale `DRAIN_WALL_CLOCK_MS = 50_000`
- cap `MAX_ITERATIONS_PER_MAILBOX = 40`

Ogni chiamata è un'invocazione edge separata (CPU budget proprio) e committa
`last_uid` per messaggio → nessun rischio sul processing per-messaggio, nessuna
modifica a check-inbox. Pattern identico a `email-sync-worker`.

NON aumentare BATCH_SIZE per "andare più veloce": rischia WORKER_RESOURCE_LIMIT
(già colpito in passato, vedi postSync detach). Il loop nel cron è la via sicura.

# Aggiornamento 2026-06-20 — visibilità mail Luca
`Scarica nuove` e il download continuo NON devono usare `x-unread-only` di default:
BODY.PEEK[] garantisce che l'import non marchi nulla come letto, mentre il filtro
UNSEEN nasconde nell'app le mail già lette da altri client ma mai importate.

`email-cron-sync` deve inoltre saltare/ruotare le vecchie righe personali senza
credenziali proprie: in passato più operatori avevano sync_state storico puntato
a `luca@tmwe.it`, rallentando il drenaggio della casella personale reale di Luca.
