

## Fix: Impedire Job Paralleli e Proteggere da Ban

### Il problema

Quando selezioni piu' paesi e clicchi "Scarica", il codice `executeDownload` (ActionPanel.tsx, righe 259-267) crea **un job per ogni paese in un loop rapido**. Tutti i job vengono inseriti nel database con status "pending" quasi simultaneamente.

Il processore (`useDownloadProcessor`) ha un guard `processingRef.current` che impedisce di prendere un secondo job dalla stessa tab. Ma questo guard e' solo in memoria del browser:
- Se la pagina si ricarica (es. hot reload di Lovable), il guard si resetta e un **secondo processore** parte su un altro job
- Il risultato e' che piu' job girano in parallelo sullo stesso account WCA, moltiplicando le richieste e causando il ban

### Soluzione (due livelli di protezione)

**Livello 1 - ActionPanel: creare UN SOLO job alla volta**

Modificare `executeDownload` per:
- Unire tutti i WCA ID di tutti i paesi selezionati in un singolo job (con la lista dei paesi nel nome)
- Oppure, piu' semplice: creare i job uno alla volta ma con un **gate nel database** che impedisce la creazione se esiste gia' un job running/pending

**Livello 2 - Processore: lock lato database**

Aggiungere un controllo nel processore prima di iniziare un job:
- Prima di cambiare lo status a "running", verificare che **nessun altro job sia gia' "running"**
- Se ce n'e' uno, non partire e aspettare

### Modifiche tecniche

**File: `src/components/download/ActionPanel.tsx`**

Nella funzione `executeDownload`, prima del loop di creazione job, aggiungere un controllo:

```text
// Check: nessun job attivo prima di creare nuovi job
const { data: activeJobs } = await supabase
  .from("download_jobs")
  .select("id")
  .in("status", ["pending", "running"])
  .limit(1);

if (activeJobs && activeJobs.length > 0) {
  toast({
    title: "Job gia' in corso",
    description: "Attendi il completamento del job attuale prima di avviarne un altro.",
    variant: "destructive",
  });
  return;
}
```

Inoltre, cambiare il loop per creare i job **in sequenza con await** e non creare il secondo se il primo e' ancora pending (anche se in pratica con il gate sopra non servira').

**File: `src/hooks/useDownloadProcessor.ts`**

Nel metodo `processJob`, subito dopo il cambio status a "running" (riga ~37), aggiungere un double-check:

```text
// Verify no other job is already running (prevent parallel execution)
const { data: runningJobs } = await supabase
  .from("download_jobs")
  .select("id")
  .eq("status", "running")
  .neq("id", jobId)
  .limit(1);

if (runningJobs && runningJobs.length > 0) {
  // Another job is already running, put this one back to pending
  await supabase.from("download_jobs")
    .update({ status: "pending", error_message: "In attesa: altro job in esecuzione" })
    .eq("id", jobId);
  return;
}
```

### Impatto
- Un solo job alla volta, sempre
- Se l'utente prova ad avviare un secondo download, riceve un messaggio chiaro
- Se il processore rileva un job parallelo (es. dopo reload), lo rimette in coda
- Zero rischio di richieste parallele al provider
