

# Piano: Download Management - Processo Strutturato di Acquisizione Partner

## Situazione Attuale

Oggi lo scraper funziona per "intervallo ID" cieco (es. 11470-11480), senza sapere a priori cosa troveremo. L'utente vuole un processo molto piu intelligente e controllato.

## Nuovo Flusso Operativo

Il processo si divide in **4 fasi sequenziali**, ognuna con il suo pannello nella nuova pagina:

```text
+------------------+     +------------------+     +------------------+     +------------------+
| FASE 1           | --> | FASE 2           | --> | FASE 3           | --> | FASE 4           |
| Analisi Network  |     | Elenco Partner   |     | Download 1-a-1   |     | Arricchimento    |
| "A quali network |     | "Carica lista    |     | "Scarica profilo |     | "Leggi sito web  |
|  apparteniamo?"  |     |  partner per      |     |  completo e      |     |  e classifica"   |
|                  |     |  paese/network"   |     |  classifica AI"  |     |  (opzionale,     |
|                  |     |                   |     |                  |     |   per gruppi)    |
+------------------+     +------------------+     +------------------+     +------------------+
```

---

## FASE 1: Analisi Network

Un pannello dove l'utente configura a quali network WCA ha accesso e verifica quali dati sono disponibili.

- **Lista network conosciuti** (WCAworld, AWS, GAA, GPLN, ecc.) con checkbox per selezionare quelli di cui si e membri
- **Test campione**: bottone "Verifica accesso dati" che scarica 3-5 profili a campione dal network selezionato per verificare se i dati di contatto personali (email, telefono diretto dei responsabili) sono effettivamente visibili
- **Report risultato**: mostra per ogni network testato:
  - Dati aziendali disponibili (si/no)
  - Email contatti visibili (si/no)
  - Nomi responsabili visibili (si/no)
  - Telefoni diretti visibili (si/no)
- Le impostazioni dei network vengono salvate in una nuova tabella `download_settings` per riutilizzo futuro

## FASE 2: Elenco Partner per Paese

Una volta scelto il network, l'utente decide **cosa scaricare** e **con che priorita**.

- **Selezione paese**: dropdown con tutti i paesi WCA, multi-selezione
- **Priorita paesi**: drag-and-drop o numerazione per decidere l'ordine di download (es. prima Italia, poi Germania, poi USA)
- **Range ID per paese**: possibilita di specificare range ID per ogni paese oppure lasciare "tutti"
- **Stima volume**: mostra quanti partner stimati ci sono per paese (basato su dati gia scaricati o stima)
- **Salvataggio coda**: la configurazione viene salvata in tabella `download_queue` con stato per ogni paese (pending, in_progress, completed)

## FASE 3: Download Uno per Uno + Classificazione AI

Questa e la fase di esecuzione vera e propria, simile allo scraper attuale ma molto piu strutturata:

- **Dashboard di avanzamento** per paese: barra progresso per ogni paese in coda
- **Download sequenziale**: un profilo alla volta con delay anti-blocco (come ora)
- **Classificazione AI automatica**: dopo ogni download, il profilo viene analizzato da Gemini (come gia accade)
- **Log in tempo reale**: lista scrollabile dei partner scaricati con esito
- **Pausa/Riprendi**: possibilita di mettere in pausa e riprendere il download
- **Statistiche live**: contatori per trovati, nuovi, aggiornati, errori

## FASE 4: Arricchimento dal Sito (Opzionale, per Gruppi)

L'arricchimento dal sito web **non e automatico** ma gestito manualmente per gruppi selezionati:

- **Filtri**: l'utente filtra i partner gia scaricati per paese, rating, tipo
- **Selezione gruppo**: checkbox per selezionare un gruppo di partner da arricchire
- **Avvio batch**: bottone "Arricchisci selezionati" che lancia l'enrichment uno alla volta
- **Progresso**: barra avanzamento e risultati per ogni partner arricchito
- Riutilizza la edge function `enrich-partner-website` gia esistente

---

## Dettagli Tecnici

### Database - Nuove tabelle

**Tabella `network_configs`** (configurazione network):
- `id` (uuid, PK)
- `network_name` (text) - es. "WCAworld", "AWS"
- `is_member` (boolean) - se siamo membri
- `has_contact_emails` (boolean) - se vediamo le email
- `has_contact_names` (boolean) - se vediamo i nomi
- `has_contact_phones` (boolean) - se vediamo i telefoni
- `sample_tested_at` (timestamp) - ultimo test campione
- `notes` (text)
- `created_at`, `updated_at`

**Tabella `download_queue`** (coda download per paese):
- `id` (uuid, PK)
- `country_code` (char 2)
- `country_name` (text)
- `network_name` (text)
- `priority` (integer) - ordine di elaborazione
- `id_range_start` (integer, nullable)
- `id_range_end` (integer, nullable)
- `status` (enum: pending, in_progress, completed, paused)
- `total_found` (integer, default 0)
- `total_processed` (integer, default 0)
- `last_processed_id` (integer, nullable) - per riprendere
- `created_at`, `updated_at`

RLS: accesso pubblico come le altre tabelle.

### Nuova pagina: `src/pages/DownloadManagement.tsx`

Pagina con 4 tab (Tabs component):
1. **Network** - Configurazione e test campione
2. **Coda Download** - Gestione paesi e priorita
3. **Download** - Esecuzione e monitoraggio
4. **Arricchimento** - Enrichment opzionale per gruppi

### Sidebar

Aggiungere voce "Download" nella sidebar con icona `Download` (o rinominare l'attuale "Export" per distinguere).

### File da creare
- `src/pages/DownloadManagement.tsx` - Pagina principale con le 4 fasi
- `src/components/download/NetworkAnalysis.tsx` - Fase 1
- `src/components/download/DownloadQueue.tsx` - Fase 2
- `src/components/download/DownloadRunner.tsx` - Fase 3 (riutilizza logica da WCAScraper)
- `src/components/download/BatchEnrichment.tsx` - Fase 4
- `src/hooks/useDownloadQueue.ts` - Hook per CRUD della coda
- `src/hooks/useNetworkConfigs.ts` - Hook per configurazione network

### File da modificare
- `src/components/layout/AppSidebar.tsx` - Aggiungere voce "Download Management"
- `src/App.tsx` - Registrare nuova route `/download-management`
- `supabase/functions/scrape-wca-partners/index.ts` - Nessuna modifica, viene riutilizzata

### Logica di ripresa download
La coda salva `last_processed_id` per ogni paese, cosi se l'utente interrompe puo riprendere esattamente da dove aveva lasciato.

