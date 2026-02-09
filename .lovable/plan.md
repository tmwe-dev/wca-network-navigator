

# Fix: Partner non visibili e "Scarica mancanti" non funziona

## Problemi trovati

Ho investigato a fondo e trovato **4 problemi interconnessi** che causano il malfunzionamento:

### 1. Country code salvato come 'XX' (54 partner coinvolti)
Lo scraper non riesce a rilevare il paese dalla pagina WCA e salva `country_code = 'XX'` come default. I 3 partner afghani sono nel database ma con `country_code = 'XX'` invece di `'AF'`. Questo causa un effetto a catena su tutto il sistema.

### 2. "Scarica 3 mancanti" crea un loop infinito
Il pulsante avvia questo ciclo senza fine:
- La lista cerca partner con `country_code = 'AF'` nel DB
- Non li trova (sono salvati come 'XX')
- Li mostra come "mancanti"
- Cliccando "Scarica", li ri-scarica, ma li salva di nuovo come 'XX'
- Il ciclo ricomincia

### 3. 25 contatti con email spazzatura
Email come "Members only - please Login to view information." (con e senza parentesi quadre, con e senza grassetto) sono state salvate nel database. Il filtro di validazione non le intercetta.

### 4. Record "Member not found" nel database
Almeno 2 record hanno `company_name = 'Member not found. Please try again.'` - il controllo anti-404 non li ha bloccati.

## Piano di correzione

### Modifica 1: Edge function `scrape-wca-partners/index.ts`
- Accettare un nuovo parametro `countryCode` nel body della richiesta
- In `saveAndRespond`, se il `country_code` parsato e' 'XX' e un `countryCode` e' stato passato dal chiamante, usare quest'ultimo
- Migliorare la validazione email per rifiutare pattern come:
  - `Members only`
  - `[Members only...]`
  - `please **Login** to view`
  - `Login to view information`
- Migliorare il filtro "not found" per catturare `Member not found. Please try again.`

### Modifica 2: Edge function `process-download-job/index.ts`
- Passare `country_code` del job allo scraper: `body: { wcaId, countryCode: job.country_code }`
- Aggiornare la verifica completamento per cercare partner sia per `country_code` che per `wca_id` (in modo che funzioni anche se il country code non corrisponde)

### Modifica 3: `src/pages/DownloadManagement.tsx` - DirectoryScanner
- Nella query dei partner dal DB (linee 803-823), aggiungere una ricerca alternativa per `wca_id` oltre che per `country_code`, cosi' i partner con 'XX' vengono trovati se il loro `wca_id` e' nella cache della directory

### Modifica 4: Pulizia dati esistenti (migrazione SQL)
- Aggiornare i 54 partner con `country_code = 'XX'` ai codici corretti usando i dati dalla `directory_cache`
- Cancellare i 25 contatti con email "Members only" spazzatura
- Cancellare i record con `company_name = 'Member not found...'`

## Sequenza implementazione

1. Prima la migrazione SQL per pulire i dati esistenti
2. Poi le modifiche alle edge functions (scraper + processor)
3. Infine la modifica al frontend (DirectoryScanner query)

