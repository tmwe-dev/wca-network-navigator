

# Scraper Automatico WCA Partners con Firecrawl

## Panoramica

Creare una funzionalita' che scarica automaticamente i partner dalla directory pubblica del sito wcaworld.com e li salva nel database. Lo scraper itererera' paese per paese, estraendo i dati dei membri dalla directory pubblica.

## Prerequisiti

Prima di tutto va collegato il **connettore Firecrawl** al progetto per ottenere la chiave API necessaria per lo scraping.

## Come funziona il sito WCA

La directory su wcaworld.com ha un form di ricerca che permette di filtrare per paese (codice ISO a 2 lettere). I risultati vengono caricati dinamicamente via JavaScript. Firecrawl puo' gestire il rendering JavaScript e restituire il contenuto completo della pagina.

Lo scraper:
1. Per ogni paese (dalla lista dei ~200 codici ISO disponibili nel dropdown), invia una richiesta di scraping alla pagina directory
2. Usa Firecrawl con formato JSON + prompt per estrarre strutturalmente i dati dei partner (nome, citta', email, telefono, ecc.)
3. Esegue upsert nel database basandosi su `company_name` + `country_code` per evitare duplicati

## Cosa verra' creato

### 1. Connettore Firecrawl
- Collegamento del connettore Firecrawl al progetto tramite il tool `connect`

### 2. Backend Function: `scrape-wca-partners`
File: `supabase/functions/scrape-wca-partners/index.ts`

Questa funzione:
- Riceve un parametro opzionale `countryCodes` (array di codici paese da scaricare; se vuoto, scarica tutti)
- Per ogni paese, usa Firecrawl per fare scraping della pagina directory WCA con il filtro paese
- Usa il formato `json` con uno schema per estrarre strutturalmente: company_name, city, email, phone, website, WCA ID
- Esegue upsert nel database (insert o update basato su company_name + country_code)
- Restituisce un report con contatori: trovati, inseriti, aggiornati, errori

### 3. API Client Frontend
File: `src/lib/api/wcaScraper.ts`

Funzione wrapper per chiamare la backend function dal frontend.

### 4. Componente UI: WCAScraper
File: `src/components/partners/WCAScraper.tsx`

Interfaccia nella pagina Import/Export con:
- Selezione paese (dropdown multi-select o "Tutti i paesi")
- Bottone "Scarica da WCA"
- Barra di progresso durante lo scraping
- Report finale: partner trovati, nuovi, aggiornati

### 5. Integrazione nella pagina Export
File: `src/pages/Export.tsx`

Aggiunta di un terzo tab "Scarica da WCA" accanto a "Importa" e "Esporta".

## Dettagli tecnici

### Backend Function - Logica principale

```text
Per ogni countryCode:
  1. Chiama Firecrawl scrape su https://www.wcaworld.com/Directory
     con waitFor per il rendering JavaScript
     usando formato JSON con schema per estrarre i dati dei partner
  2. Parse dei risultati estratti
  3. Per ogni partner trovato:
     - Cerca nel DB per company_name + country_code
     - Se esiste: aggiorna i campi
     - Se non esiste: inserisci nuovo record
  4. Accumula statistiche (nuovi, aggiornati, errori)
```

### Schema di estrazione Firecrawl

Lo schema JSON definira' i campi da estrarre:
- company_name (obbligatorio)
- city (obbligatorio)
- country_code / country_name
- email, phone, website
- WCA ID (se visibile)
- Networks/certificazioni

### Gestione limiti e rate limiting

- Lo scraping avverra' un paese alla volta per evitare sovraccarichi
- Timeout configurabile per ogni richiesta
- Possibilita' di riprendere lo scraping da dove si era interrotto in caso di errore

### Sequenza dei file da creare/modificare

1. Collegare connettore Firecrawl
2. Creare `supabase/functions/scrape-wca-partners/index.ts`
3. Aggiornare `supabase/config.toml` per JWT verification
4. Creare `src/lib/api/wcaScraper.ts`
5. Creare `src/components/partners/WCAScraper.tsx`
6. Modificare `src/pages/Export.tsx` (aggiungere tab "Scarica da WCA")

