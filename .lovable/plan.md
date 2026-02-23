

# Piano: Vista Attivita nell'Agenda

## Obiettivo

Aggiungere una nuova tab **"Attivita"** nella pagina Agenda (Reminders) che mostri tutte le attivita di tutti i partner in un'unica vista centralizzata, raggruppate per paese, con i contatti visibili e il contatto selezionato evidenziato.

## Situazione attuale

- La tabella `activities` esiste gia nel database con i campi: `partner_id`, `activity_type` (send_email, phone_call, meeting, follow_up, etc.), `status`, `priority`, `due_date`, `assigned_to`
- La tabella `campaign_jobs` gestisce separatamente i job di campagna
- La pagina Agenda (`Reminders.tsx`) ha solo reminders, nessuna vista attivita
- Il componente `ActivityList` esiste ma e usato solo nel dettaglio singolo partner
- **Manca**: un campo `selected_contact_id` nella tabella activities per tracciare quale contatto e stato scelto per l'attivita

## Modifiche al Database

### Migrazione SQL

Aggiungere alla tabella `activities`:
- `selected_contact_id` (uuid, nullable, FK verso `partner_contacts.id`) -- il contatto scelto per questa attivita
- `campaign_batch_id` (text, nullable) -- collegamento opzionale al batch della campagna

Questo permette di:
1. Sapere esattamente quale contatto gestire per ogni attivita
2. Collegare le attivita create dalle campagne al batch di origine

## Modifiche al Codice

### 1. Hook `useActivities.ts` -- Nuova query globale

Aggiungere `useAllActivities()` che carica tutte le attivita con join su:
- `partners` (company_name, country_code, country_name, city)
- `partner_contacts` via `selected_contact_id` (name, email, phone, mobile)
- `team_members` (name dell'assegnatario)

Supporta filtri per: stato, tipo attivita, paese, assegnatario.

### 2. Componente `ActivitiesTab.tsx` (nuovo)

Vista a due livelli:

**Livello 1 -- Raggruppamento per Paese**
- Lista dei paesi con contatore attivita pendenti
- Bandiera + nome paese + badge con conteggio
- Click per espandere/collassare

**Livello 2 -- Lista Attivita per Paese**
Per ogni attivita mostra:
- Icona tipo (email, telefono, WhatsApp, meeting, follow-up)
- Nome azienda partner
- **Contatto selezionato evidenziato** (nome, email/telefono)
- Se nessun contatto selezionato, mostra i contatti disponibili con possibilita di sceglierne uno
- Stato (pending/in_progress/completed) con toggle rapido
- Data scadenza
- Assegnatario

**Barra filtri in alto:**
- Filtro per tipo (Email, Telefono, WhatsApp, Meeting, Altro)
- Filtro per stato (Da fare, In corso, Completate)
- Filtro per assegnatario (team members)

### 3. Integrazione in `Reminders.tsx`

Aggiungere una quarta tab "Attivita" accanto a Calendar, Pending, Completed:
```text
[Calendar] [Pending] [Completed] [Attivita]
```

La tab Attivita renderizza il nuovo componente `ActivitiesTab`.

### 4. Collegamento con le Campagne

Quando dalla pagina Campaigns si creano campaign_jobs, creare anche le corrispondenti `activities` con:
- `activity_type` = "send_email" o "phone_call" secondo il job_type
- `campaign_batch_id` = il batch_id della campagna
- `selected_contact_id` = il contatto scelto (se gia selezionato)

Questo avviene nel hook `useCreateCampaignJobs` aggiungendo un inserimento parallelo nella tabella activities.

### 5. Selezione contatto inline

Nella vista attivita, per ogni partner con piu contatti:
- Mostra un mini-dropdown con i contatti disponibili
- Il contatto selezionato viene salvato in `selected_contact_id`
- Il contatto selezionato appare evidenziato con sfondo colorato e icona check

## Riepilogo File

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiunge `selected_contact_id` e `campaign_batch_id` alla tabella activities |
| `src/hooks/useActivities.ts` | Aggiunge `useAllActivities()` con join e filtri |
| `src/components/agenda/ActivitiesTab.tsx` | **Nuovo** -- Vista attivita raggruppata per paese |
| `src/pages/Reminders.tsx` | Aggiunge tab "Attivita" |
| `src/hooks/useCampaignJobs.ts` | Modifica per creare activities quando si generano campaign jobs |

## Flusso Utente

```text
Agenda --> Tab "Attivita"
  |
  +-- Filtri: [Tipo] [Stato] [Assegnatario]
  |
  +-- Italia (5 attivita)
  |     +-- ABC Logistics -- Email -- Mario Rossi (mario@abc.it) -- [v] Completata
  |     +-- XYZ Freight -- Telefono -- [Seleziona contatto...] -- [ ] Da fare
  |
  +-- Germania (3 attivita)
        +-- Berlin Cargo -- Follow-up -- Hans Mueller -- [ ] In corso
```

