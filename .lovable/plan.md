

## Fix: Colonna Sinistra Non Aggiornata Dopo Download

### Problema

La CountryGrid (colonna sinistra) mostra 0 email e 0 telefoni per l'Albania nonostante il download sia completato con successo (11/11). Il motivo e' semplice: le query che alimentano i contatori hanno un `staleTime` di 60 secondi e **non vengono mai invalidate** dal processore di download al termine di un job.

Il processore (`useDownloadProcessor.ts`) invalida solo queste query:
- `download-jobs`
- `ops-global-stats`

Ma la CountryGrid si basa su tre query diverse:
- `contact-completeness` (conteggi email/telefono per paese)
- `partner-counts-by-country-with-type` (numero partner per paese)
- `cache-data-by-country` (dati directory cache)

Nessuna di queste viene invalidata dopo il completamento di un job, quindi i dati restano a zero finche' l'utente non ricarica manualmente la pagina.

### Soluzione

Aggiungere l'invalidazione di queste tre query nel processore di download, sia durante il processing (ogni N profili) che al completamento del job.

### Modifiche tecniche

**File: `src/hooks/useDownloadProcessor.ts`**

1. Nel blocco `finally` (riga 246-249), aggiungere:
   - `queryClient.invalidateQueries({ queryKey: ["contact-completeness"] })`
   - `queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] })`
   - `queryClient.invalidateQueries({ queryKey: ["cache-data-by-country"] })`

2. Durante il loop di processing, dopo ogni profilo salvato con successo (circa riga 190), aggiungere un'invalidazione periodica (ogni 5 profili) per aggiornare la colonna sinistra anche durante il download, non solo alla fine:
   ```
   if (processedSet.size % 5 === 0) {
     queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
     queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
   }
   ```

### Impatto
- Zero modifiche alla UI o al layout
- La colonna sinistra si aggiornera' automaticamente durante e dopo i download
- Nessun rischio di regressione: si tratta solo di aggiungere invalidazioni di cache React Query

