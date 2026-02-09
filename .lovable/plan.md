

# Completamento verificato con flag esplicito

## Problema
Il sistema determina "Completo" confrontando semplicemente il numero di partner nel DB con il numero di ID nella directory cache (`pCount >= cCount`). Questo e inaffidabile perche:
- I conteggi possono non corrispondere (partner importati da altre fonti, ID duplicati, ecc.)
- Non c'e nessuna verifica che **ogni singolo ID** della directory sia stato effettivamente scaricato
- L'utente viene ingannato con un badge "Completo" che non e garantito

## Soluzione

### 1. Aggiungere colonna `download_verified` alla tabella `directory_cache`

Nuova colonna booleana `download_verified` (default `false`) che viene impostata a `true` **solo** quando il sistema verifica, ID per ID, che tutti i membri della cache sono presenti nella tabella `partners`.

Aggiungere anche `verified_at` (timestamp) per sapere quando e stata fatta la verifica.

### 2. Verifica reale nel codice (PickCountry)

Invece di confrontare conteggi, la query di completamento:
- Legge la lista di WCA ID dalla `directory_cache.members` (JSONB)
- Controlla nella tabella `partners` quali di quegli ID esistono effettivamente
- Marca come "Completo" solo se **tutti** gli ID della cache hanno un corrispondente partner
- Se verificato, aggiorna `download_verified = true` nella cache

### 3. Il badge "Completo" appare SOLO con flag verificato

Nella griglia paesi:
- **Senza flag**: mostra sempre il rapporto numerico (es. "7/11") anche se i numeri coincidono
- **Con flag**: mostra "Completo" in verde con icona di verifica

### 4. Verifica automatica post-download

Nel `process-download-job`, quando un job raggiunge lo stato `completed`, il sistema esegue automaticamente la verifica e aggiorna il flag nella `directory_cache`.

---

## Dettagli Tecnici

### Migrazione SQL
```text
ALTER TABLE directory_cache
  ADD COLUMN download_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamptz;
```

### File: `src/pages/DownloadManagement.tsx`

**PickCountry** (~linee 385-493):
- Nuova query per `directory_cache` che include anche `download_verified`
- Cambiare la logica del badge:
  - `isComplete` diventa `cacheRow.download_verified === true` (non piu un confronto numerico)
  - Il rapporto numerico viene mostrato sempre (es. "11/11" oppure "7/11")
  - Il badge "Completo" appare solo se `download_verified === true`

**DirectoryScanner** (~azioni post-scansione):
- Dopo che tutti i partner sono scaricati, eseguire una funzione di verifica che:
  1. Legge tutti i `wca_id` dalla `directory_cache.members`
  2. Controlla quali esistono in `partners`
  3. Se tutti presenti, aggiorna `download_verified = true, verified_at = now()`

### File: `supabase/functions/process-download-job/index.ts`

Quando il job raggiunge `status = 'completed'`:
- Dopo aver aggiornato lo stato, eseguire la verifica cross-referencing
- Aggiornare `directory_cache.download_verified` di conseguenza

