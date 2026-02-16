
# Regola globale: MAI piu' di una chiamata per volta

## Problema

Quando clicchi "Scarica", il sistema lancia piu' chiamate in parallelo:
1. `triggerCheck()` internamente fa 3 chiamate (syncCookie, verifySession, updateStatusInDb)
2. Subito dopo, un'altra chiamata al DB per controllare `wca_session_status`
3. Poi `executeDownload` controlla i job attivi E crea job in un loop

Inoltre `useCreateDownloadJob` non ha nessun controllo anti-duplicato: se clicchi per 5 paesi, crea 5 insert quasi simultanei.

## Soluzione

### 1. Serializzare il flusso pre-download in ActionPanel

File: `src/components/download/ActionPanel.tsx`

Il metodo `handleStartDownload` viene riscritto con un flusso strettamente sequenziale:
- Passo 1: `triggerCheck()` (gia' sequenziale internamente)
- Passo 2: SE autenticato, procedere. SE no, mostrare dialog. STOP.
- Passo 3: Controllare job attivi nel DB
- Passo 4: Creare i job UNO ALLA VOLTA con `await` tra ogni insert

Rimuovere il secondo controllo ridondante su `app_settings` dopo `triggerCheck` (faceva una chiamata doppia inutile).

### 2. Guard anti-duplicato nella creazione job

File: `src/hooks/useDownloadJobs.ts` - `useCreateDownloadJob`

Prima dell'insert, verificare se esiste gia' un job `pending` o `running` per lo stesso `country_code` + `network_name`. Se esiste, saltare silenziosamente senza errore.

### 3. Deduplicazione nel "Riavvia Tutti"

File: `src/hooks/useDownloadJobs.ts` - `useResumeAllJobs`

Per ogni combinazione `country_code` + `network_name`, tenere solo il job con `current_index` piu' alto. Cancellare definitivamente i duplicati.

### 4. Fermare il loop del processore sulla sessione scaduta

File: `src/hooks/useDownloadProcessor.ts`

Quando `verifySessionBeforeJob` fallisce (sessione scaduta), il processore attualmente pausa il job e poi va al prossimo, pausando ANCHE quello. Questo genera N chiamate inutili per N job in coda.

Correzione: quando la sessione e' scaduta, fermare il loop completamente (`state.stopped = true`). Non ciclare sugli altri job.

## Dettagli tecnici

### ActionPanel - flusso sequenziale

```text
handleStartDownload:
  1. const result = await triggerCheck()
  2. if (!result?.authenticated) -> mostra dialog, RETURN
  3. const activeJobs = await checkActiveJobs()
  4. if (activeJobs > 0) -> toast errore, RETURN
  5. for (country of selectedCountries) {
       await createJob(country)  // uno alla volta, con await
     }
```

Rimuovere completamente il fallback che rilegge `app_settings` dopo `triggerCheck` (righe 186-191 attuali).

### useCreateDownloadJob - guard

```text
// Prima dell'insert:
const { data: existing } = await supabase
  .from("download_jobs")
  .select("id")
  .eq("country_code", params.country_code)
  .eq("network_name", params.network_name)
  .in("status", ["pending", "running"])
  .limit(1);

if (existing && existing.length > 0) return existing[0].id; // skip silenzioso
```

### useDownloadProcessor - stop su sessione scaduta

```text
// In processJob, dopo verifySessionBeforeJob fallisce:
if (!sessionOk) {
  await supabase.from("download_jobs").update({
    status: "paused",
    error_message: "Sessione WCA non attiva",
  }).eq("id", jobId);
  state.stopped = true;  // FERMA IL LOOP, non passare al prossimo job
  return;
}
```

### useResumeAllJobs - dedup

```text
// Dopo aver trovato i job cancellati incompleti:
// Raggruppare per country_code+network_name
// Per ogni gruppo, tenere solo quello con current_index piu' alto
// Cancellare definitivamente gli altri dal DB
// Rimettere in pending solo quelli sopravvissuti
```

## File modificati

1. `src/components/download/ActionPanel.tsx` -- rimuovere chiamate ridondanti, serializzare il flusso
2. `src/hooks/useDownloadJobs.ts` -- guard anti-duplicato in creazione + dedup in riavvia tutti
3. `src/hooks/useDownloadProcessor.ts` -- stop loop su sessione scaduta (una sola riga: `state.stopped = true`)
