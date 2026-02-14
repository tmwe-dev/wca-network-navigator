
# Piano: Contatti nelle Schede Job + Sezione Template in Settings

## Panoramica

Attualmente i job mostrano solo il nome azienda e un singolo email/telefono generico. In realta' ogni azienda ha piu' contatti (persone reali con nome, ruolo, email personale, telefono diretto). Il sistema deve mostrare questi contatti e permettere di scegliere a chi scrivere o chi chiamare.

Inoltre, serve una nuova sezione "Template" nelle Impostazioni per caricare documenti (brochure, PDF, allegati) da associare alle email.

---

## 1. Caricare i contatti nella pagina Jobs

### Modifiche a `src/hooks/useCampaignJobs.ts`

Aggiungere una query separata che, dato un array di `partner_id`, carica tutti i contatti dalla tabella `partner_contacts`. Questo viene esposto come hook `useJobContacts(partnerIds)`.

Struttura contatto:
- `name` (es. "Mr. Christian Halpaus")
- `title` (es. "CEO")
- `email` (es. "christian@iff.com")
- `direct_phone`, `mobile`
- `partner_id` (per collegare al job)

### Modifiche a `src/components/campaigns/JobList.tsx`

Nella lista, sotto il nome azienda, mostrare il numero di contatti disponibili (es. "3 contatti") e un'icona che indica quanti hanno email/telefono.

### Modifiche a `src/components/campaigns/JobCanvas.tsx`

La canvas diventa la scheda di lavoro completa. Quando selezioni un job:

**Sezione superiore -- Info Azienda:**
- Nome azienda, paese, citta' (come ora)
- Email e telefono generici dell'azienda (dalla tabella `partners`)

**Sezione centrale -- Lista Contatti:**
- Elenco di tutte le persone associate a quell'azienda (da `partner_contacts`)
- Ogni contatto mostra: nome, ruolo/titolo, email personale, telefono diretto, mobile
- Checkbox per selezionare uno o piu' contatti come destinatari
- Indicatori visivi: verde se ha email, blu se ha telefono, grigio se mancano dati

**Sezione azioni:**
- "Prepara Email" e "Programma Call" agiscono sui contatti selezionati
- Area note (come ora)
- "Segna come completato"

---

## 2. Sezione Template nelle Impostazioni

### Migrazione database

Creare una tabella `email_templates` per i documenti/template:
- `id` (uuid, PK)
- `name` (text) -- nome descrittivo (es. "Brochure Servizi 2026")
- `file_url` (text) -- URL del file nello storage
- `file_name` (text) -- nome file originale
- `file_size` (integer) -- dimensione in bytes
- `file_type` (text) -- mime type
- `category` (text) -- es. "brochure", "listino", "presentazione"
- `created_at`, `updated_at`
- RLS pubblica

Creare un bucket di storage `templates` (pubblico) per i file uploadati.

### Nuovo componente `src/components/settings/TemplateManager.tsx`

Pannello di gestione template con:
- Upload di file (drag & drop o click) verso il bucket `templates`
- Lista dei template caricati con: nome, tipo file, dimensione, data caricamento
- Possibilita' di rinominare, categorizzare e cancellare template
- Preview del nome file e icona in base al tipo (PDF, DOC, immagine)

### Modifiche a `src/pages/Settings.tsx`

Aggiungere una nuova tab **"Template"** con icona `FileText` che mostra il `TemplateManager`.

---

## 3. Collegamento Template ai Jobs (predisposizione)

Nella JobCanvas, sotto le azioni, aggiungere una sezione "Allegati" che mostra i template disponibili (caricati dal bucket) con checkbox per selezionare quali allegare. Questo prepara il terreno per quando verra' implementato il composer email vero e proprio.

---

## Dettaglio tecnico -- File

### Da creare:
- `src/components/settings/TemplateManager.tsx` -- gestione upload/lista template
- Migrazione SQL -- tabella `email_templates` + bucket storage `templates`

### Da modificare:
- `src/hooks/useCampaignJobs.ts` -- aggiungere hook `useJobContacts`
- `src/components/campaigns/JobCanvas.tsx` -- espandere con lista contatti e sezione allegati
- `src/components/campaigns/JobList.tsx` -- mostrare conteggio contatti
- `src/pages/CampaignJobs.tsx` -- passare i contatti alla canvas
- `src/pages/Settings.tsx` -- aggiungere tab Template

### Flusso dati contatti:

```text
CampaignJobs (pagina)
  |-- Raccoglie tutti i partner_id unici dai jobs
  |-- Chiama useJobContacts(partnerIds)
  |-- Passa contactsByPartnerId a JobCanvas
  |
  JobCanvas
    |-- Riceve job + contacts[] per quel partner
    |-- Mostra lista contatti con checkbox
    |-- Azioni (email/call) agiscono sui selezionati
```
