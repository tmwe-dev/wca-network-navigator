

# Allineamento Acquisizione e Download Management

## Problemi identificati

### 1. La coda si perde cambiando pagina
La pagina Acquisizione usa solo `useState` (stato React locale). Quando navighi via, tutto sparisce: coda, progresso, partner processati. La pagina Download Management invece salva tutto nella tabella `download_jobs` nel database e funziona in background.

### 2. L'Acquisizione non crea job in background
Quando avvii l'acquisizione, tutto gira nel browser. Se chiudi la pagina o navighi altrove, il processo si ferma. Download Management invece usa una funzione server che si auto-rilancia e continua anche a browser chiuso.

### 3. Scansione network incompleta
Quando non selezioni nessun network specifico nell'Acquisizione, il sistema scansiona solo "WCA Inter Global" come default (riga 132), invece di scansionare tutti i network disponibili. Ecco perche' la Svizzera mostra solo 7 risultati.

### 4. Le due pagine non comunicano
Download Management non sa nulla di cio' che fa Acquisizione e viceversa. Sono due sistemi completamente separati.

---

## Piano di correzione

### Fase 1: Fix immediato della scansione multi-network

**File: `src/pages/AcquisizionePartner.tsx`**

Quando `selectedNetworks` e' vuoto (= "tutti i network"), il sistema deve scansionare TUTTI i network dalla lista `WCA_NETWORKS`, non solo "WCA Inter Global".

Cambio alla riga 98:
```
// PRIMA:
const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [""];

// DOPO:
const networkFilter = selectedNetworks.length > 0
  ? selectedNetworks
  : WCA_NETWORKS.map(n => n);  // Scan ALL networks
```

E alla riga 132, rimuovere il fallback hardcoded:
```
// PRIMA:
networkName: net || "WCA Inter Global"

// DOPO:
networkName: net
```

### Fase 2: Integrazione con download_jobs per persistenza

**File: `src/pages/AcquisizionePartner.tsx`**

Far si' che quando la pipeline parte, crei un `download_job` nel database (come fa Download Management). Questo garantisce:
- La coda e' visibile in Download Management
- Il progresso e' persistente
- Se l'utente cambia pagina e torna, puo' vedere cosa stava succedendo

Modifiche:
1. Importare `useCreateDownloadJob` da `useDownloadJobs`
2. Prima di iniziare il loop, creare un job nel DB con `status: "running"` e `job_type: "acquisition"`
3. Durante il loop, aggiornare `current_index`, `last_processed_company` etc. nel DB
4. Alla fine, marcare come `completed`

Il processing resta nel browser (per l'estensione Chrome), ma lo stato e' nel database.

### Fase 3: Ripristino coda al rientro nella pagina

**File: `src/pages/AcquisizionePartner.tsx`**

Al mount della pagina, controllare se esiste un `download_job` con `status: "running"` e `job_type: "acquisition"`:
- Se esiste e non e' completato, ricaricare la coda dal job (i `wca_ids` e `processed_ids` sono nel DB)
- Mostrare un avviso: "C'e' un'acquisizione in corso. Vuoi riprendere?"
- L'utente puo' riprendere dal punto in cui si era fermato

### Fase 4: Visibilita' in Download Management

**File: `src/components/download/JobMonitor.tsx`**

I job di tipo "acquisition" appariranno automaticamente nel JobMonitor perche' sono nella stessa tabella `download_jobs`. Aggiungere solo un badge per distinguere i tipi:
- `job_type: "download"` -> badge "Download"
- `job_type: "acquisition"` -> badge "Acquisizione"

---

## Dettagli tecnici

### Struttura dati (tabella `download_jobs` -- nessuna migrazione necessaria)

La tabella ha gia' il campo `job_type` con default `'download'`. I job dell'Acquisizione useranno `job_type: 'acquisition'`.

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Fix network scan + creazione job nel DB + ripristino al mount |
| `src/components/download/JobMonitor.tsx` | Badge per tipo job (acquisition vs download) |
| `src/data/wcaFilters.ts` | Nessuna modifica (usato come import) |

### Flusso aggiornato

```text
Utente seleziona paese + network
        |
        v
  Scansione directory (TUTTI i network se non specificato)
        |
        v
  Crea download_job nel DB (job_type: "acquisition")
        |
        v
  Loop nel browser (scrape + extension + enrich)
  -> Aggiorna download_job ad ogni partner
        |
        v
  Se l'utente naviga via:
  -> Il processing si ferma (e' nel browser)
  -> Ma lo stato e' nel DB
  -> Tornando su Acquisizione, puo' riprendere
        |
        v
  Il job appare anche in Download Management
```

### Cosa NON cambia

- Il processing dell'Acquisizione resta nel browser (necessario per l'estensione Chrome)
- Download Management continua a usare il processing server-side (edge function)
- Le due pagine ora condividono la stessa tabella `download_jobs` per visibilita'

