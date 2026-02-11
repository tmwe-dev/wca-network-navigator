

# Blacklist WCA: Importazione, Scraping Automatico e Notifiche

## Panoramica

Creare un sistema completo per gestire la blacklist WCA con due modalita':
1. **Importazione manuale** di file Excel/CSV dalla pagina WCA
2. **Scraping automatico** periodico della pagina https://www.wcaworld.com/WCAworldBlacklist
3. **Visualizzazione** dello stato blacklist nei partner (card sinistra e pannello destro)
4. **Promemoria settimanale** per aggiornare la blacklist

## Struttura del file analizzato

Il file contiene 328 aziende con queste colonne:
- `No.` - numero progressivo
- `CompanyName` - nome azienda
- `City` - citta'
- `Country` - paese
- `Status` - Active, Bankrupt, Closed, ecc.
- `Claims` - lista di claims con date e importi
- `TotalOwedAmount` - totale dovuto

## Modifiche pianificate

### 1. Nuova tabella database: `blacklist_entries`

```sql
CREATE TABLE blacklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_no integer,
  company_name text NOT NULL,
  city text,
  country text,
  status text,
  claims text,
  total_owed_amount numeric,
  matched_partner_id uuid REFERENCES partners(id),
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Con indice su `company_name` e `country` per il matching veloce.

### 2. Nuova tabella: `blacklist_sync_log`

Per tracciare quando e' stata aggiornata la blacklist:

```sql
CREATE TABLE blacklist_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL, -- 'manual_import' o 'auto_scrape'
  entries_count integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

### 3. Settings: nuova tab "Blacklist"

Aggiungere una quarta tab nella pagina Settings con:

- **Sezione Upload**: input file per caricare Excel/CSV della blacklist
  - Parsing del file con la struttura identificata (No., CompanyName, City, Country, Status, Claims, TotalOwedAmount)
  - Preview dei primi 10 record prima dell'importazione
  - Upsert nel database (aggiorna se gia' presente, inserisce se nuovo)
  - Matching automatico con i partner esistenti per `company_name` + `country`

- **Sezione Scraping Automatico**: bottone per avviare lo scraping manuale + configurazione intervallo automatico
  - Bottone "Scrape Ora" che invoca la edge function
  - Indicatore dell'ultimo aggiornamento
  - Toggle per abilitare/disabilitare lo scraping automatico

- **Sezione Stato**: tabella riassuntiva con:
  - Numero totale aziende in blacklist
  - Numero di match trovati con i nostri partner
  - Data ultimo aggiornamento

### 4. Edge Function: `scrape-wca-blacklist`

Nuova edge function che:
- Usa Firecrawl per scrappare la pagina https://www.wcaworld.com/WCAworldBlacklist
- Parsa il contenuto HTML/markdown per estrarre la tabella
- Esegue upsert nella tabella `blacklist_entries`
- Esegue matching con la tabella `partners` basato su company_name (fuzzy) e country
- Aggiorna `matched_partner_id` per ogni match trovato
- Salva un log in `blacklist_sync_log`

### 5. Componente `BlacklistImport.tsx`

Nuovo componente per la tab Settings che gestisce:
- Upload file XLS/CSV
- Parsing lato client delle righe (il formato ha claims multi-linea tra virgolette)
- Invio batch al database
- Matching automatico post-import

### 6. Indicatore Blacklist nel Partner Hub

Nella card sinistra e nel pannello destro:
- Se il partner ha un match in `blacklist_entries`, mostrare un badge rosso "BLACKLIST" con icona `ShieldAlert`
- Tooltip con dettagli: status, totale dovuto, numero claims
- Nel pannello destro: sezione collapsible con la lista completa dei claims

### 7. Promemoria settimanale

Aggiungere in `app_settings` una chiave `blacklist_last_updated` con la data dell'ultimo aggiornamento. Nel dashboard o nella sidebar, mostrare un avviso se sono passati piu' di 7 giorni dall'ultimo aggiornamento.

## Dettaglio tecnico

### Parsing del file Excel

Il file e' in formato CSV con virgolette per i campi multi-linea (claims). Il parser deve:
1. Gestire i campi tra virgolette che contengono newline
2. Estrarre `No.`, `CompanyName`, `City`, `Country`, `Status`, `Claims` (testo raw), `TotalOwedAmount`
3. Normalizzare i nomi dei paesi per il matching (es. "UAE" -> "United Arab Emirates")

### Matching con i partner

Il matching avviene per:
1. **Esatto**: `LOWER(company_name)` uguale
2. **Parziale**: il nome della blacklist e' contenuto nel nome partner o viceversa
3. **Paese**: stesso paese come conferma del match

### Flusso dello scraping automatico

```text
[Trigger: manuale o cron]
        |
        v
[Edge Function: scrape-wca-blacklist]
        |
        v
[Firecrawl: scrape pagina WCA]
        |
        v
[Parse HTML -> estrai tabella]
        |
        v
[Upsert blacklist_entries]
        |
        v
[Match con partners]
        |
        v
[Aggiorna blacklist_sync_log]
```

### File da creare/modificare

| File | Operazione |
|------|------------|
| Migration SQL | Creare tabelle `blacklist_entries` e `blacklist_sync_log` |
| `src/components/settings/BlacklistManager.tsx` | Nuovo componente per upload e gestione |
| `src/hooks/useBlacklist.ts` | Hook per query e mutazioni blacklist |
| `src/pages/Settings.tsx` | Aggiungere tab "Blacklist" |
| `src/pages/PartnerHub.tsx` | Badge e indicatore blacklist nelle card |
| `supabase/functions/scrape-wca-blacklist/index.ts` | Edge function per scraping automatico |
| `supabase/config.toml` | Registrare la nuova edge function |

