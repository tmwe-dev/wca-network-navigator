
# Piano: Pagina Jobs per Campagne

## Cosa cambia

### 1. Rinominare il pulsante in Campaigns
Il pulsante "Genera Email" nell'header della pagina Campagne diventa **"Genera Jobs"**. Invece di aprire il dialog EmailPreview, naviga verso una nuova pagina `/campaign-jobs` passando i partner selezionati.

### 2. Nuova tabella database: `campaign_jobs`
Serve una tabella per persistere i job generati dalle campagne, separata dalle `activities` (che sono task interni). Ogni riga rappresenta un'azione da compiere verso un partner specifico.

Colonne:
- `id` (uuid, PK)
- `partner_id` (uuid, NOT NULL)
- `company_name` (text)
- `country_code` (char 2)
- `country_name` (text)
- `city` (text)
- `email` (text, nullable)
- `phone` (text, nullable)
- `job_type` (enum: `email`, `call`) -- default `email`
- `status` (enum: `pending`, `in_progress`, `completed`, `skipped`) -- default `pending`
- `assigned_to` (uuid, nullable)
- `notes` (text, nullable)
- `batch_id` (uuid) -- per raggruppare i job creati nella stessa sessione
- `created_at`, `completed_at`

RLS: policy pubblica (come le altre tabelle del progetto, dato che non c'e' autenticazione).

### 3. Nuova pagina `/campaign-jobs`

Layout a due colonne (40/60):

**Colonna sinistra -- Elenco Jobs:**
- Lista scrollabile di tutti i job raggruppati per batch
- Ogni riga mostra: bandiera paese, nome azienda, citta', icona email/telefono, stato (pending/done)
- Ogni riga e' selezionabile (click per vedere dettagli a destra)
- Filtri in alto: tipo (email/call/tutti), stato, ricerca testo
- Contatori in alto: totale, email disponibili, telefoni disponibili

**Colonna destra -- Canvas di lavoro:**
- Mostra i dettagli del job selezionato
- Info partner: nome, paese, citta', email, telefono
- Due azioni principali con pulsanti evidenti:
  - **"Prepara Email"** -- apre un composer email con template precompilato
  - **"Programma Call"** -- sposta il job nel tipo "call" e permette di impostare data/ora (integrazione futura col calendario)
- Area note per appunti liberi
- Pulsante "Segna come completato"

**Header della pagina:**
- Pulsanti di azione globale: "Segna tutti come completati", contatori statistici
- Link per tornare alle Campagne

### 4. Flusso completo

```text
Campagne (seleziona partner dal globo)
    |
    v
Click "Genera Jobs"
    |
    v
Inserisce righe in campaign_jobs (batch_id comune)
    |
    v
Naviga a /campaign-jobs
    |
    v
Il team lavora la lista: prepara email o programma call
```

### 5. Navigazione

- Aggiungere la rotta `/campaign-jobs` in App.tsx
- NON aggiungere voce nella sidebar (e' una sotto-pagina di Campaigns, raggiungibile solo da li' o tramite link diretto)
- Aggiornare AppLayout con titolo "Campaign Jobs"

## File da creare

- `src/pages/CampaignJobs.tsx` -- pagina principale con layout 40/60
- `src/components/campaigns/JobList.tsx` -- colonna sinistra con elenco
- `src/components/campaigns/JobCanvas.tsx` -- colonna destra con dettagli e azioni
- `src/hooks/useCampaignJobs.ts` -- hook per CRUD sulla tabella campaign_jobs

## File da modificare

- `src/pages/Campaigns.tsx` -- cambiare testo pulsante, logica di navigazione
- `src/App.tsx` -- aggiungere rotta
- `src/components/layout/AppLayout.tsx` -- aggiungere info pagina nell'header

## Migrazione database

Creazione tabella `campaign_jobs` con enum per `job_type` e `status`, e policy RLS pubbliche.

## Dettaglio tecnico

Il passaggio dei partner selezionati da Campaigns a CampaignJobs avviene tramite inserimento nel database: il pulsante "Genera Jobs" inserisce tutti i partner in `campaign_jobs` con un `batch_id` condiviso, poi naviga a `/campaign-jobs?batch=<batch_id>`. La pagina Jobs carica i dati dal DB, quindi sopravvive ai refresh.
