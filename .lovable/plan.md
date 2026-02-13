

## Fix: Job di Download che Non Partono nell'Operations Center

### Problema Root-Cause

L'Operations Center crea record nella tabella `download_jobs` con status "pending", ma il codice che effettivamente processa i profili (loop di scraping tramite Chrome Extension) esiste solo nella pagina Acquisizione Partner (`/acquisizione`). L'Operations Center non ha nessun "motore" di processing: sa creare e monitorare i job, ma non li esegue.

### Soluzione

Estrarre la logica di processing dei download job dalla pagina `AcquisizionePartner.tsx` in un hook riutilizzabile (`useDownloadProcessor`), e montarlo nell'Operations Center in modo che i job vengano effettivamente elaborati.

### Piano di implementazione

**1. Creare `src/hooks/useDownloadProcessor.ts`**

Hook che:
- Osserva i job con status "pending" o "running"
- Per ogni job attivo, esegue il loop di processing:
  - Prende il prossimo WCA ID dalla lista `wca_ids`
  - Usa l'estensione Chrome (via `useExtensionBridge`) per estrarre i contatti
  - Aggiorna il job nel DB: `current_index`, `processed_ids`, `last_processed_company`, `contacts_found_count`, `contacts_missing_count`, `last_contact_result`
  - Applica il delay configurato tra un profilo e l'altro
  - Gestisce pausa/resume/cancel leggendo lo status dal DB
  - Al termine, chiama l'edge function `process-download-job` con action "complete"
- Logica estratta dal loop esistente in `AcquisizionePartner.tsx` (linee 112-450 circa), semplificata per i download puri (senza canvas UI, senza AI enrichment)

**2. Montare il processor nell'Operations Center**

In `src/pages/Operations.tsx`:
- Importare e chiamare `useDownloadProcessor()` a livello pagina
- Il hook si attiva automaticamente quando ci sono job pending/running
- L'ActiveJobBar e il JobMonitor continuano a mostrare il progresso in tempo reale tramite i dati aggiornati nel DB (Realtime gia' configurato)

**3. Migliorare l'ActiveJobBar per mostrare cosa sta succedendo**

- Aggiungere un indicatore di stato piu' chiaro: "Scaricando..." con il nome dell'azienda corrente
- Mostrare il contatore contatti trovati/mancanti in tempo reale
- Se l'estensione Chrome non e' disponibile, mostrare un messaggio esplicito: "Estensione Chrome necessaria"

### Dettagli Tecnici

**Nuovo file: `src/hooks/useDownloadProcessor.ts`**

```text
Responsabilita':
- Polling del job attivo ogni 2s (o Realtime)
- Loop di processing sequenziale:
  1. Legge job.wca_ids[job.current_index]
  2. Verifica se partner esiste gia' nel DB (skip se contatti completi)
  3. Chiama extensionBridge.extractContacts(wcaId)
  4. Salva i contatti nel DB (partner_contacts)
  5. Aggiorna download_jobs: current_index++, processed_ids, contatori
  6. Attende delay_seconds prima del prossimo
  7. Controlla se job e' stato messo in pausa/cancellato
- Gestione errori: se estensione non disponibile, pausa automatica con messaggio
- Al completamento: chiama edge function complete + verifica
```

**File modificato: `src/pages/Operations.tsx`**
- Aggiunta di `useDownloadProcessor()` nel componente principale
- Zero impatto su layout/UI (il processor lavora in background)

**File modificato: `src/components/download/ActiveJobBar.tsx`**
- Aggiunta indicatore "Scaricando [nome azienda]..." quando il processor e' attivo
- Messaggio di errore se estensione Chrome non rilevata
- Badge contatti trovati/mancanti in tempo reale

### Flusso risultante

```text
Utente seleziona paese --> Clicca "Scarica"
    |
    v
Creazione record download_jobs (status: pending)
    |
    v
useDownloadProcessor rileva job pending --> status: running
    |
    v
Loop: per ogni WCA ID:
  - Estensione Chrome estrae contatti
  - Salva in partner_contacts
  - Aggiorna progresso nel DB
  - ActiveJobBar mostra progresso live
    |
    v
Completamento --> edge function verifica + aggiorna network_configs
```

### Nota importante

Il processing dei job dipende dall'estensione Chrome WCA installata nel browser. Se l'estensione non e' presente, il job verra' automaticamente messo in pausa con un messaggio chiaro nell'ActiveJobBar che spiega all'utente cosa fare.

