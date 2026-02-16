
# Eliminare i job duplicati e prevenire duplicazioni future

## Problema

Ci sono 421 job in stato "pending" per soli 198 paesi. Molti paesi hanno job multipli (USA: 15, India: 6, Argentina: 5, ecc.). Questo accade perche':
- La creazione di nuovi job non controlla se ne esiste gia' uno per lo stesso paese/network
- "Riavvia Tutti" rimette in pending job che erano gia' stati ricreati
- Il processore poi tenta di eseguirli tutti in sequenza, rallentando enormemente il sistema

## Soluzione in 3 passi

### 1. Pulizia immediata: eliminare i duplicati dal database

Eseguire una query SQL che per ogni combinazione paese/network mantiene solo il job piu' recente e cancella tutti gli altri duplicati in stato "pending".

### 2. Prevenzione duplicati nella creazione job

File: `src/hooks/useDownloadJobs.ts` - funzione `useCreateDownloadJob`

Prima di inserire un nuovo job, controllare se esiste gia' un job "pending" o "running" per lo stesso `country_code` e `network_name`. Se esiste, non crearne uno nuovo e mostrare un avviso.

### 3. Prevenzione duplicati nel "Riavvia Tutti"

File: `src/hooks/useDownloadJobs.ts` - funzione `useResumeAllJobs`

Quando rimette in pending i job cancellati, per ogni combinazione paese/network selezionare solo il job con il progresso maggiore (`current_index` piu' alto) e scartare i duplicati, cancellandoli definitivamente.

## Dettagli tecnici

### Pulizia SQL (una tantum)
```text
-- Per ogni country_code + network_name, tieni solo il job pending piu' recente
DELETE FROM download_jobs
WHERE id NOT IN (
  SELECT DISTINCT ON (country_code, network_name) id
  FROM download_jobs
  WHERE status = 'pending'
  ORDER BY country_code, network_name, current_index DESC, created_at DESC
)
AND status = 'pending';
```

### useCreateDownloadJob
```text
// Prima dell'insert, check:
const { data: existing } = await supabase
  .from("download_jobs")
  .select("id")
  .eq("country_code", params.country_code)
  .eq("network_name", params.network_name)
  .in("status", ["pending", "running"])
  .limit(1);

if (existing && existing.length > 0) {
  throw new Error("Job gia' in coda per questo paese/network");
}
```

### useResumeAllJobs
```text
// Dopo aver trovato i job cancellati incompleti, deduplicare:
// Per ogni country_code+network_name, tieni solo quello con current_index piu' alto
// Gli altri vengono marcati come "cancelled" definitivamente
```

## File modificati

1. **Migrazione SQL** -- pulizia duplicati esistenti
2. `src/hooks/useDownloadJobs.ts` -- guard in creazione + dedup in riavvia tutti
