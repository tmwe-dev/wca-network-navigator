

## Piano: Download Robusto con Coda di Retry e Risultati Falliti

### Problema
Quando un profilo non viene caricato (timeout, sessione instabile), viene marcato come "processato" e perso. Il sistema non distingue tra "profilo inesistente" e "errore temporaneo", e non offre un secondo tentativo ne visibilita sui fallimenti.

### Architettura proposta

```text
PASS 1 (normale)
  for each wcaId:
    → OK           → salva, avanti
    → pageLoaded=false → sposta in retryQueue, avanti
    → timeout      → sposta in retryQueue, avanti
    → "member not found" (SOLO se pageLoaded=true) → skip permanente

PASS 2 (retry, delay +50%)
  for each wcaId in retryQueue:
    → OK           → salva
    → fallito      → aggiungi a failed_ids (definitivo)

RISULTATO FINALE
  Job completato con failed_ids visibili nell'UI
  Ogni fallito mostra link diretto al profilo WCA
```

### Modifiche tecniche

**1. Database: aggiungere colonna `failed_ids` a `download_jobs`**
- Migrazione SQL: `ALTER TABLE download_jobs ADD COLUMN failed_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`
- Conterrà gli WCA ID definitivamente falliti dopo entrambi i pass

**2. `src/hooks/useDownloadProcessor.ts` — Ristrutturare il loop**

- Aggiungere array locale `retryQueue: number[]`
- **Riordinare la detection** (fix falsi positivi):
  1. Se `pageLoaded === false` → push in `retryQueue`, NON in `processedSet`
  2. Se `pageLoaded === true` E contiene "member not found" → skip permanente (processedSet)
  3. Se timeout → push in `retryQueue`
- Dopo il loop principale, se `retryQueue.length > 0` e non abortito:
  - Log "Inizio retry pass — N profili da riprovare"
  - Aumentare il delay del 50% (`job.delay_seconds * 1.5`)
  - Eseguire un secondo loop identico sui `retryQueue` IDs
  - I profili che falliscono di nuovo vanno in `failedIds[]`
- A fine job, salvare `failed_ids` nel database
- Il contatore `consecutiveSkipped` per la guardia sessione (3 skip) resta attivo in entrambi i pass

**3. `src/hooks/useDownloadJobs.ts` — Aggiungere `failed_ids` all'interfaccia**
- Aggiungere `failed_ids: number[]` all'interfaccia `DownloadJob`

**4. `src/components/download/JobDataViewer.tsx` — Sezione "Profili Falliti"**

Dopo la card del partner corrente, se il job ha `failed_ids.length > 0`, mostrare una sezione dedicata:
- Titolo: "Profili non scaricati (N)"
- Per ogni WCA ID fallito: mostrare nome dalla directory_cache + link cliccabile `https://members.wcaworld.com/profile/{wcaId}` che apre in nuova tab
- Badge rosso "Non raggiungibile"
- Questo permette all'utente di andare direttamente sulla pagina WCA e verificare manualmente

**5. `src/components/download/JobMonitor.tsx` — Indicatore falliti**

Nella card del job completato, se `failed_ids.length > 0`:
- Mostrare badge arancione "N non scaricati" accanto ai contatori
- Cliccando apre il JobDataViewer sulla tab dei falliti

### Cosa NON cambia
- Il checkpoint 15s resta invariato
- La politica Zero Retry per singola richiesta resta (nessun retry immediato)
- Il mutex globale e il flusso seriale restano identici
- La guardia sessione (3 consecutivi) resta attiva

