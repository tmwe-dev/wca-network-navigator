

# Fix: Email Sync che non va in timeout

## Problema
La funzione `check-inbox` usa `full: true` per scaricare l'intero messaggio RFC822 (inclusi allegati da MB). Con 3891 email e allegati pesanti, il CPU della Edge Function esplode anche con batch di 5.

## Soluzione
Sostituire `full: true` con un approccio a 2 step leggero:

1. **ENVELOPE** per headers (from, to, subject, date, message-id) — pochi byte
2. **BODY[1]** o **BODY[1.1]** per il testo — solo la parte text/plain, senza allegati

Niente più download di allegati interi durante il sync. Gli allegati si scaricano dopo, on-demand.

## Modifiche a `supabase/functions/check-inbox/index.ts`

### Step 1 — Rimuovere il fetch `full: true` e PostalMime
- Eliminare l'import di `postal-mime` (non serve più)
- Eliminare il blocco `rawFetch` con `full: true` (righe 287-299)
- Eliminare tutto il parsing PostalMime (righe 312-361)

### Step 2 — Usare solo ENVELOPE + BODY text section
Per ogni UID:
```
fetch(uid, { byUid: true, uid: true, envelope: true, bodyStructure: true })
```
- Da `envelope`: from, to, subject, date, messageId, inReplyTo
- Da `bodyStructure`: individuare la sezione text/plain (tipicamente "1" o "1.1")
- Poi un secondo fetch leggero: `BODY[sezione_testo]` per il body

### Step 3 — Checkpoint per messaggio
Dopo ogni messaggio salvato con successo, aggiornare `last_uid` nel DB. Così se il timeout arriva al messaggio 4, i primi 3 sono già salvi e il prossimo batch riparte dal 4.

### Step 4 — Batch size a 3
Ridurre da 5 a 3 messaggi per batch per stare larghi nei limiti CPU.

## Risultato atteso
- Ogni messaggio richiede ~100-500ms invece di secondi
- Nessun download di allegati (solo metadati)
- Sync progressiva: ogni call avanza di 3 messaggi, il frontend chiama in loop
- Con ~1300 call si sincronizzano tutte le 3891 email (la sync continua automatica già esiste)

