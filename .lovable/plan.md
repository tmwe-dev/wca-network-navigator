

## Analisi TMW Engine — Cosa ho trovato

Ho letto in profondità 3 pagine e 6 componenti dal progetto TMW Engine. Ecco il confronto con il nostro sistema attuale.

### Cosa fa TMW Engine che noi NON abbiamo

**1. Pagina "Record Importati" dedicata** (`RecordImportati.tsx`)
Una pagina full-page per navigare i contatti importati con:
- **Griglia di card compatte** (`CompactContactCard`) — 4 colonne desktop, con checkbox, bandiera paese, contatto, badge origine, e icone azione rapida (crea attività, email, telefono)
- **Filtri avanzati** — ricerca testo, filtro per origine, paese, "nascondi contatti con attività completate oggi" (switch), "solo con note" (checkbox)
- **Ordinamento per colonna** con click sugli header
- **Paginazione robusta** con 25/50/100/250/500 record per pagina
- **Azioni bulk dalla selezione** — genera alias AI, crea attività multiple
- **Toggle colonne visibili** — base / dettagli commerciali / metadata

**2. Form Attività Avanzato** (`AdvancedMultipleActivityForm.tsx`)
Un form a tab (Email / Chiamata) con:
- Lista dei contatti selezionati con info (azienda, email, telefono)
- Tab Email: oggetto, corpo, template email, allegati drag-and-drop, editor fullscreen
- Tab Chiamata: note, programmazione futura con data/ora
- Conferma invio: "Invia ora" vs "Programma per dopo"
- Supporto allegati esistenti dalla memoria

**3. Dialog Gestione Attività** (`GestisciAttivitaDialog.tsx`)
Dialog per modificare un'attività esistente con:
- Tab Dettagli (stato, priorità, scadenza con calendar picker + time, descrizione)
- Tab Email (composizione con template e allegati)
- Tab Altro (note, storico modifiche)
- Propagazione modifiche telefono al contatto rubrica

### Cosa abbiamo noi che loro NON hanno
- AI mapping delle colonne con drag-and-drop per correzione
- Import assistant conversazionale
- Re-import correction workflow
- Data quality dashboard post-import
- Trasferimento a Partner (loro hanno "rubrica", noi "partners")

### Piano di implementazione

Adatteremo le 3 maschere principali di TMW Engine al nostro schema dati (`imported_contacts`, `activities`, `partners`).

#### Task 1: Pagina Record Importati con Card Grid

Creare una nuova visualizzazione nella pagina Import (tab "Contatti") che sostituisce la lista piatta attuale con:

- **Card compatte a griglia** (1-4 colonne responsive) per ogni contatto importato
- Ogni card mostra: checkbox, company_name, name, country flag, city, origin badge
- Icone azione rapida: crea attività (email/call), visualizza dettaglio
- **Filtri**: ricerca testo (company_name, name, city), filtro per origin, country (Select), records per pagina
- **Paginazione** client-side (25/50/100/250)
- **Selezione multipla** con "seleziona tutti della pagina"
- **Barra azioni bulk** quando ci sono selezioni: "Crea Attività" (apre il form avanzato), "Trasferisci a Partner"

File coinvolti:
- `src/components/import/CompactContactCard.tsx` (nuovo — adattato da TMW)
- `src/pages/Import.tsx` (modifica tab Contatti)

#### Task 2: Form Attività Multiplo Avanzato

Sostituire il semplice `AssignActivityDialog` con un form a tab ispirato a TMW:

- **Tab Email**: oggetto, corpo email con textarea espandibile, selezione template esistenti
- **Tab Chiamata/Follow-up**: note, programmazione con data+ora
- Lista contatti selezionati visibile in alto con info
- Scelta "Invia subito" vs "Programma" per le email
- Priorità e assegnazione

File coinvolti:
- `src/components/import/AdvancedActivityForm.tsx` (nuovo — adattato da TMW)
- `src/pages/Import.tsx` (integrazione nel tab Contatti)

#### Task 3: Dialog Gestione Attività Singola

Creare un dialog per visualizzare/modificare un'attività esistente associata a un contatto:

- Tab Dettagli: stato, priorità, scadenza (calendar + time picker), descrizione
- Tab Email: composizione/modifica email
- Storico modifiche
- Accessibile cliccando sul nome azienda nella card o dall'icona attività

File coinvolti:
- `src/components/import/ManageActivityDialog.tsx` (nuovo)

### Mappatura schema TMW → Nostro sistema

| TMW Engine | Nostro sistema |
|---|---|
| `imported_contacts` (company_name, name, email, phone, cell, country, city, origin, alias, company_alias) | `imported_contacts` (company_name, name, email, phone, mobile, country, city, origin, contact_alias, company_alias) |
| `rubrica` (nome, azienda, email, telefono, cellulare) | `partners` + `partner_contacts` |
| `attivita` (tipo, descrizione, stato, scadenza, priorita, rubrica_id) | `activities` (activity_type, title, description, status, due_date, priority, partner_id) |
| `email_templates` (nome, oggetto, contenuto) | `email_templates` (name, file_url) — struttura diversa |

Nessuna modifica al database necessaria. Tutto si adatta alle tabelle esistenti.

