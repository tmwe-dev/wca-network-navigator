
# Indicatore contatti trovati nel monitoraggio download

## Cosa cambia

Quando un job di download processa un partner, attualmente mostra solo "Ultimo: NomeAzienda #123". L'utente non sa se email/telefono sono stati trovati o meno.

La soluzione aggiunge un feedback visivo immediato per ogni partner processato, mostrando chiaramente se i contatti sono stati estratti con successo.

## Come funziona

### 1. Nuove colonne nel database (`download_jobs`)

Aggiungere due colonne intere per tracciare i conteggi in tempo reale:
- `contacts_found_count` (default 0) -- quanti partner hanno avuto almeno email o telefono
- `contacts_missing_count` (default 0) -- quanti partner non avevano ne' email ne' telefono

Aggiungere anche una colonna testuale per il feedback visivo dell'ultimo risultato:
- `last_contact_result` (text, nullable) -- es. "email+phone", "email_only", "phone_only", "no_contacts"

### 2. Edge function `process-download-job`

Dopo aver chiamato `scrape-wca-partners` e ottenuto il risultato, leggere `result.partner.email` e `result.partner.phone` dal response. Aggiornare il job con:
- Incrementare `contacts_found_count` se almeno uno presente
- Incrementare `contacts_missing_count` se entrambi assenti
- Impostare `last_contact_result` al valore appropriato

### 3. Hook `useDownloadJobs`

Aggiungere i tre nuovi campi all'interfaccia `DownloadJob`.

### 4. UI `JobCard` nel DownloadManagement

Nella riga "Ultimo: NomeAzienda", aggiungere un badge colorato accanto:
- Verde con icona check: "Email + Tel" (entrambi trovati)
- Azzurro: "Solo Email" o "Solo Tel" (uno dei due)
- Rosso/grigio con X: "No contatti" (nessuno trovato)

Sotto la barra di progresso, aggiungere un riepilogo compatto:
```text
Contatti trovati: 45/77 (58%)  |  Mancanti: 32
```
con barra di progresso secondaria verde/rossa proporzionale.

## Dettagli tecnici

### Migrazione SQL
```text
ALTER TABLE download_jobs 
  ADD COLUMN contacts_found_count integer DEFAULT 0,
  ADD COLUMN contacts_missing_count integer DEFAULT 0,
  ADD COLUMN last_contact_result text;
```

### Modifica edge function (process-download-job/index.ts, ~riga 99-113)
Dopo `result.success && result.found`, controllare:
```text
const hasEmail = !!result.partner?.email
const hasPhone = !!result.partner?.phone
const contactResult = hasEmail && hasPhone ? 'email+phone'
  : hasEmail ? 'email_only'
  : hasPhone ? 'phone_only'
  : 'no_contacts'
const foundIncrement = (hasEmail || hasPhone) ? 1 : 0
const missingIncrement = (!hasEmail && !hasPhone) ? 1 : 0
```
Poi nel `.update()` aggiungere i campi con incremento tramite SQL raw o ricalcolo dal contatore corrente.

### Modifica JobCard UI (DownloadManagement.tsx, ~riga 1751-1757)
Badge colorato accanto al nome azienda e contatore riepilogativo sotto la progress bar.

### File modificati
- Migrazione SQL (nuove colonne)
- `supabase/functions/process-download-job/index.ts`
- `src/hooks/useDownloadJobs.ts`
- `src/pages/DownloadManagement.tsx`
