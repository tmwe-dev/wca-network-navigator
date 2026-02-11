

# Fix Acquisizione: Nomi nella coda, stop automatico e background

## Problemi identificati

### 1. La coda mostra "WCA 121870" invece dei nomi aziendali
**Causa**: Quando la scansione della directory viene eseguita nella pagina Acquisizione, i risultati NON vengono salvati nella tabella `directory_cache`. L'ActionPanel del Download Management ha una funzione `saveScanToCache` (riga 138), ma l'Acquisizione non ce l'ha. Quindi:
- La prima scansione funziona (i nomi arrivano dal risultato fresco)
- Ma se l'utente naviga via e torna, il resume cerca nella `directory_cache` e nella tabella `partners` -- ma la cache non contiene i dati della scansione fatta dall'Acquisizione
- I partner non ancora processati non sono nella tabella `partners`, quindi restano come "WCA {id}"

### 2. Il download si ferma dopo 2 partner senza contatti
**Causa**: Riga 276: `MAX_CONSECUTIVE_EMPTY = 2`. Dopo soli 2 partner consecutivi senza contatti, il sistema mette automaticamente in pausa e mostra un toast. L'utente vuole che il sistema AVVISI ma NON si fermi da solo. L'utente decidera' se fermarsi.

### 3. L'acquisizione non gira in background come il Download Management
**Causa**: Il processing dell'Acquisizione gira nel browser (loop `for` in React). Quando l'utente naviga via, tutto si ferma. Il Download Management invece usa la edge function `process-download-job` che si auto-rilancia. L'Acquisizione non puo' usare al 100% lo stesso sistema perche' dipende dall'estensione Chrome (per i contatti privati), ma il download base puo' girare in background. L'acquisizione potrebbe delegare la parte di download alla edge function `process-download-job` gia' esistente, mantenendo l'arricchimento via estensione come step opzionale quando l'utente torna.

---

## Piano di correzione

### Fix 1: Salvare i risultati della scansione nella cache

**File: `src/pages/AcquisizionePartner.tsx`**

Dopo che la scansione restituisce i risultati (sia da cache che da scan fresco), salvare nella tabella `directory_cache` con upsert, esattamente come fa l'ActionPanel:

```typescript
// Dopo aver ricevuto scanResult.members dalla edge function:
const membersJson = members.map(m => ({
  company_name: m.company_name,
  city: m.city,
  country_code: code,
  wca_id: m.wca_id
}));

await supabase.from("directory_cache").upsert({
  country_code: code,
  network_name: net,  // "" per tutti i network
  members: membersJson,
  total_results: members.length,
  scanned_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
```

Questo garantisce che al resume la coda possa recuperare i nomi dalla cache.

### Fix 2: Avvisare senza fermare il download

**File: `src/pages/AcquisizionePartner.tsx`**

Cambiare il comportamento alle righe 582-597:
- Rimuovere `pauseRef.current = true` e la logica di attesa
- Mostrare solo un toast di avviso
- Aumentare `MAX_CONSECUTIVE_EMPTY` a 5 per ridurre falsi allarmi
- Mantenere il check della sessione WCA al primo partner vuoto (riga 567) come protezione iniziale

```typescript
// PRIMA: si ferma
if (consecutiveNoContacts >= MAX_CONSECUTIVE_EMPTY) {
  pauseRef.current = true;
  setPipelineStatus("paused");
  // ...attende...
}

// DOPO: avvisa soltanto
if (consecutiveNoContacts >= MAX_CONSECUTIVE_EMPTY) {
  toast({
    title: "Qualita' dati bassa",
    description: `${MAX_CONSECUTIVE_EMPTY} partner consecutivi senza contatti. Controlla la sessione WCA.`,
  });
  consecutiveNoContacts = 0; // Reset per non spammare toast
}
```

### Fix 3: Delegare il download base alla edge function in background

**File: `src/pages/AcquisizionePartner.tsx`**

Quando l'utente avvia l'acquisizione:
1. Creare il `download_job` nel DB (gia' implementato)
2. Chiamare la edge function `process-download-job` con il `jobId` per avviare il processing in background
3. Il download dei profili base gira server-side (auto-chaining)
4. L'arricchimento via estensione Chrome resta opzionale: quando l'utente e' sulla pagina, la UI mostra i partner scaricati e permette l'estrazione contatti via estensione in tempo reale
5. Se l'utente naviga via, il download base continua in background; tornando, puo' vedere il progresso e avviare l'arricchimento sui partner gia' scaricati

Modifiche:
- Nella funzione `startPipeline`, dopo aver creato il job, invocare `supabase.functions.invoke("process-download-job", { body: { jobId } })` per avviare il background processing
- Aggiungere un polling con `setInterval` per aggiornare la coda leggendo il progresso dal DB (ogni 3-5 secondi)
- Quando un partner viene completato dal server, la UI lo mostra nel canvas e offre l'estrazione contatti via estensione se disponibile
- Se l'estensione non e' disponibile, il download prosegue comunque con i contatti server-side

---

## Dettagli tecnici

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Salvare scan in cache + rimuovere auto-stop + delegare a edge function |

### Flusso aggiornato

```text
Utente avvia Acquisizione
        |
        v
  Crea download_job nel DB
  Invoca process-download-job (background)
        |
        v
  Edge function scarica profili (auto-chaining)
  UI fa polling dal DB ogni 3-5s
        |
        v
  Per ogni partner scaricato:
  - Se utente e' sulla pagina + estensione attiva:
    -> Estrae contatti privati via estensione
  - Se utente naviga via:
    -> Download continua in background
    -> Contatti server-side salvati comunque
        |
        v
  Utente torna: vede progresso, puo' arricchire i mancanti
```

### Cosa NON cambia
- La edge function `process-download-job` non necessita modifiche (gia' gestisce il download base)
- Il JobMonitor nel Download Management mostra gia' i job di tipo "acquisition"
- Il sistema di cache della directory resta lo stesso formato

