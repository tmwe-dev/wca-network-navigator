

## Piano: Integrazione Report Aziende

### Panoramica
ReportAziende.it e' un database di 5.9M aziende italiane con 16M+ contatti e manager. L'integrazione prevede: una nuova sezione dedicata nell'app, credenziali nelle Impostazioni, e un'estensione Chrome per lo scraping autenticato (stesso approccio usato per WCA).

### 1. Database - Nuove tabelle

**`prospects`** - Contatti non-WCA (struttura separata da `partners`)
- id, company_name, partita_iva, codice_fiscale
- city, province, region, address, cap
- phone, email, pec, website
- fatturato, utile, dipendenti, anno_bilancio
- codice_ateco, descrizione_ateco
- forma_giuridica, data_costituzione
- rating_affidabilita, credit_score
- source (default: 'reportaziende')
- raw_profile_html, enrichment_data (jsonb)
- created_at, updated_at

**`prospect_contacts`** - Manager/responsabili delle aziende
- id, prospect_id (FK), name, role (amministratore, socio, etc.)
- codice_fiscale, email, phone, linkedin_url
- created_at

**`prospect_social_links`** - Link social dei contatti
- id, prospect_id, contact_id, platform, url

### 2. Impostazioni - Tab "Report Aziende"

Aggiungere un nuovo tab nella pagina Settings con:
- Campo username/email per ReportAziende
- Campo password per ReportAziende
- Pulsante "Salva Credenziali" (salva in `app_settings` come `ra_username` e `ra_password`)
- Stato connessione (badge Connesso/Non connesso)
- Download estensione Chrome dedicata (come per WCA)

### 3. Estensione Chrome - ReportAziende Scraper

Creare una seconda estensione (o estendere quella esistente) che:
- Si inietti sulle pagine di `reportaziende.it` e `ecommerce2.reportaziende.it`
- Faccia login automatico con le credenziali salvate
- Sincronizzi i cookie di sessione
- Estragga i dati dalle pagine dei risultati di ricerca e dalle schede azienda

File da creare in `public/ra-extension/`:
- manifest.json (permessi per reportaziende.it)
- background.js (login, cookie sync, estrazione dati)
- content.js (bridge con la webapp)
- popup.html/js (stato connessione)

### 4. Nuova pagina - "Prospect" (o "Aziende IT")

Nuova route `/prospects` con:
- Lista aziende importate da ReportAziende
- Filtri: regione, provincia, codice ATECO, range fatturato, numero dipendenti
- Vista dettaglio con dati finanziari, management, contatti
- Indicatori di qualita' dati (come per i partner WCA)

### 5. Edge Functions

**`save-ra-credentials`** - Salva username/password criptati
**`check-ra-session`** - Verifica se la sessione e' attiva
**`save-ra-cookie`** - Salva cookie di sessione
**`save-ra-prospects`** - Salva i dati estratti nel database

### 6. Sidebar

Aggiungere voce "Prospect" nel menu di navigazione con icona Building2 (aziende italiane).

### Dettagli tecnici

**File nuovi:**
- `src/pages/Prospects.tsx` - Pagina principale
- `src/components/prospects/ProspectList.tsx` - Lista con filtri
- `src/components/prospects/ProspectDetail.tsx` - Dettaglio azienda
- `src/hooks/useProspects.ts` - Hook dati
- `src/hooks/useRASessionStatus.ts` - Stato sessione ReportAziende
- `public/ra-extension/manifest.json`
- `public/ra-extension/background.js`
- `public/ra-extension/content.js`
- `public/ra-extension/popup.html`
- `public/ra-extension/popup.js`
- `supabase/functions/save-ra-cookie/index.ts`
- `supabase/functions/save-ra-prospects/index.ts`

**File da modificare:**
- `src/App.tsx` - Aggiungere route `/prospects`
- `src/components/layout/AppSidebar.tsx` - Aggiungere voce menu
- `src/pages/Settings.tsx` - Aggiungere tab "Report Aziende"

**Approccio scraping:** Identico a WCA - tutte le richieste partono dal browser dell'utente tramite estensione Chrome per evitare blocchi IP. Il server funge solo da storage.

**Nota:** Per scoprire i parametri esatti di ricerca (filtri ATECO, regioni, etc.) e la struttura HTML delle pagine risultato, servira' esplorare il sito autenticato. Possiamo iniziare con l'infrastruttura (DB + Settings + estensione base) e poi affinare lo scraper una volta che avrai inserito le credenziali e potremo analizzare le pagine interne.

