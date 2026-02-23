
# Piano: "Genera Jobs" crea Attivita (non campaign_jobs)

## Obiettivo

Il pulsante **"Genera Jobs"** nella pagina Campaigns deve inserire i record direttamente nella tabella `activities` con `campaign_batch_id` impostato, invece di usare la tabella `campaign_jobs`. In questo modo tutte le attivita -- sia manuali che da campagna -- vivono in un'unica tabella e sono visibili nella tab Attivita dell'Agenda.

## Cosa cambia

### 1. Modifica `Campaigns.tsx` -- funzione `onGenerateJobs`

Attualmente inserisce in `campaign_jobs`. Verra modificata per:
- Inserire in `activities` con:
  - `partner_id`
  - `activity_type` = `"send_email"` (default campagna email)
  - `title` = `"Campagna Email - {company_name}"`
  - `campaign_batch_id` = UUID generato
  - `priority` = `"medium"`
- Dopo l'inserimento, navigare alla pagina Agenda con la tab Attivita aperta (es. `/reminders?tab=attivita&batch={batchId}`)

### 2. Modifica `ActivitiesTab.tsx` -- filtro per campagna

Aggiungere:
- Un filtro/badge "Campagna" che permetta di vedere solo le attivita con `campaign_batch_id` non null
- Se si arriva dalla pagina Campaigns con un `batch` specifico nella URL, pre-filtrare su quel batch

### 3. Pagina `CampaignJobs.tsx` -- Deprecazione

La pagina CampaignJobs diventa opzionale/deprecata poiche i dati ora sono gestiti dalla tab Attivita. Per ora la lasciamo ma il flusso principale passa per Agenda > Attivita.

## Dettagli tecnici

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/Campaigns.tsx` | `onGenerateJobs` inserisce in `activities` invece di `campaign_jobs` |
| `src/components/agenda/ActivitiesTab.tsx` | Aggiunge filtro "Campagna" e supporto query param `batch` |
| `src/pages/Reminders.tsx` | Supporta query param `tab=attivita` per aprire la tab giusta |

### Logica di inserimento (Campaigns.tsx)

```text
Per ogni partner selezionato:
  INSERT INTO activities (
    partner_id,
    activity_type = 'send_email',
    title = 'Campagna Email - {company_name}',
    campaign_batch_id = batchId,
    priority = 'medium'
  )
```

### Filtro campagna (ActivitiesTab.tsx)

- Nuovo chip filtro "Campagna" nella barra filtri
- Se attivo, mostra solo attivita con `campaign_batch_id IS NOT NULL`
- Se query param `batch=xyz` presente, filtra per quel batch specifico

Nessuna modifica al database necessaria -- i campi `campaign_batch_id` e `selected_contact_id` sono gia presenti nella tabella `activities`.
