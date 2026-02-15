

# Zero Retry: Ogni Interazione WCA = 1 Solo Tentativo

## Riepilogo delle modifiche

Tre aree di intervento per garantire che ogni contatto con WCA avvenga una sola volta, senza eccezioni.

---

## 1. Download Profili (`useDownloadProcessor.ts`)

**Problema**: Righe 144-147 -- quando `pageLoaded === false`, il sistema aspetta 5 secondi e poi `continue`, ritentando lo stesso profilo nel loop (perche' non viene aggiunto a `processedSet`).

**Soluzione**: Invece di `continue`, il profilo viene marcato come `skipped` in `processedSet`, loggato come "SKIP" nel terminale, contato come `contactsMissing`, e il loop prosegue al profilo successivo senza alcuna richiesta aggiuntiva a WCA.

Codice attuale (righe 144-147):
```
if (result.pageLoaded === false) {
  await new Promise(r => setTimeout(r, 5000));
  continue;
}
```

Nuovo codice:
```
if (result.pageLoaded === false) {
  await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — saltato`);
  contactsMissing++;
  processedSet.add(wcaId);
  // Aggiorna il job e prosegui (nessun retry)
  await supabase.from("download_jobs").update({
    current_index: processedSet.size,
    processed_ids: [...processedSet] as any,
    last_processed_wca_id: wcaId,
    last_contact_result: "skipped",
    contacts_missing_count: contactsMissing,
  }).eq("id", jobId);
  // Delay standard prima del prossimo profilo
  if (i < wcaIds.length - 1 && !cancelRef.current) {
    const actualDelay = calcDelay(settings.baseDelay, settings.variation);
    await appendLog(jobId, "WAIT", `${actualDelay}s`);
    await new Promise(r => setTimeout(r, actualDelay * 1000));
  }
  continue;
}
```

**Seconda ottimizzazione** (righe 104-134): il blocco "Ensure partner exists" interroga `directory_cache` per ogni profilo nuovo. Dato che gli ID vengono gia' dal job (che a sua volta li ha presi dalla cache), possiamo pre-caricare la mappa `wcaId -> {name, city}` dalla cache UNA SOLA VOLTA all'inizio del job, eliminando query ripetute.

Nuovo approccio: prima del loop, caricare tutti i membri dalla cache:
```
// Pre-load directory cache map (una volta)
const cacheMap = new Map<number, { name: string; city: string }>();
const { data: cacheEntries } = await supabase
  .from("directory_cache")
  .select("members")
  .eq("country_code", job.country_code);
for (const entry of (cacheEntries || [])) {
  for (const m of (entry.members as any[] || [])) {
    if (m.wca_id) cacheMap.set(m.wca_id, { name: m.company_name || `WCA ${m.wca_id}`, city: m.city || "" });
  }
}
```

Poi nel loop, sostituire la query `directory_cache` con un semplice `cacheMap.get(wcaId)`.

Stessa ottimizzazione per il blocco "Post-extraction fallback" (righe 251-265): usare `cacheMap` invece di interrogare di nuovo il DB.

---

## 2. Pipeline Acquisizione (`AcquisizionePartner.tsx`)

**Problema**: Righe 229-248 -- quando `pageLoaded === false`, il profilo viene messo in una `retryQueue`. Poi righe 515-541 processano tutta la retry queue con nuove richieste WCA.

**Soluzione**: 
- Rimuovere completamente la `retryQueue` (riga 94)
- Quando `pageLoaded === false`, marcare il profilo come `done` (non `pending`), incrementare il contatore `failedLoads`, e proseguire senza nessun retry
- Eliminare l'intero blocco "Process retry queue" (righe 515-542)

---

## 3. Scansione Directory (`scrape-wca-directory`)

La edge function `scrape-wca-directory` gia' non ha retry interni -- fa una sola chiamata Firecrawl per pagina. Anche `handleScan` in `AcquisizionePartner.tsx` non ritenta le pagine fallite. Nessuna modifica necessaria qui.

---

## Risultato finale

| Scenario | Prima | Dopo |
|---|---|---|
| 80 profili, tutto OK | 80 richieste WCA | 80 richieste WCA |
| 80 profili, 10 falliti | fino a 160 richieste | **80 richieste** |
| Caso peggiore assoluto | illimitato (loop) | **esattamente N richieste = N profili** |

I profili saltati (`skipped`) restano nel database con `last_contact_result: "skipped"` e possono essere rieseguiti con un nuovo job dedicato in un secondo momento.

### File modificati
1. `src/hooks/useDownloadProcessor.ts` -- rimuovere retry su `pageLoaded === false`, pre-caricare cache map
2. `src/pages/AcquisizionePartner.tsx` -- rimuovere `retryQueue` e relativo blocco di processing

