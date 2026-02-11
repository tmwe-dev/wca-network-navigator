

# Architettura stabile: ZERO richieste server-side a WCA

## Problema reale trovato

Ho analizzato ogni riga di codice. Ecco cosa succede:

**Ogni volta che il sistema scarica un profilo WCA, la Edge Function `scrape-wca-partners` fa una richiesta HTTP diretta a `wcaworld.com` dal server di Supabase** (file `scrape-wca-partners/index.ts`, funzione `directFetchPage`, riga 565-601). Questa richiesta parte dall'IP del server, NON dal tuo browser.

WCA vede il tuo cookie usato da due IP diversi (il tuo PC e il server Supabase) e invalida la sessione. Succede ad ogni singolo profilo scaricato.

Inoltre, `save-wca-cookie/index.ts` (riga 43) chiama `testCookieDeep()` che fa un'altra richiesta HTTP a WCA dal server quando salvi il cookie. Altro colpo alla sessione.

```text
FLUSSO ATTUALE (che rompe la sessione):

Browser (tuo IP) --> login su WCA --> cookie valido
                                         |
Edge Function (IP server) --> fetch WCA con il TUO cookie --> WCA vede 2 IP --> INVALIDA sessione
```

## Soluzione: tutto passa dall'estensione Chrome

L'estensione Chrome gira nel tuo browser, stesso IP, stessa sessione. Nessun conflitto di IP.

```text
FLUSSO NUOVO (sessione stabile):

Browser (tuo IP) --> login su WCA --> cookie valido
                                         |
Estensione (tuo IP) --> apre tab WCA --> stesso IP --> sessione STABILE
                                         |
                                    salva dati --> database
```

### Modifiche specifiche:

### 1. Rimuovere `testCookieDeep` da `save-wca-cookie`

**File**: `supabase/functions/save-wca-cookie/index.ts`

Eliminare la chiamata `testCookieDeep()` (riga 43). Il cookie viene salvato e lo stato viene determinato solo dalla presenza di `.ASPXAUTH` nel cookie, senza MAI fare richieste HTTP a WCA.

### 2. Modalita' "extension-only" nel job processor

**File**: `supabase/functions/process-download-job/index.ts`

Il job processor smette di chiamare `scrape-wca-partners` (che fa `directFetchPage` dal server). Invece:
- Il job avanza l'indice e segna il WCA ID come "da processare"
- Il frontend (che ha l'estensione) fa il lavoro reale tramite l'extension bridge
- Il server si occupa solo di tenere traccia del progresso

Il flusso diventa:
1. Job creato con lista WCA IDs
2. Frontend poll il job, vede il prossimo ID da processare
3. Frontend chiede all'estensione di aprire la pagina e estrarre i dati
4. Estensione salva i contatti nel DB tramite `save-wca-contacts`
5. Frontend segna l'ID come completato e passa al successivo

### 3. Scraper server-side come fallback senza cookie

**File**: `supabase/functions/scrape-wca-partners/index.ts`

Lo scraper server-side rimane ma opera SOLO senza il cookie dell'utente. Serve come fallback per estrarre dati pubblici (nome azienda, citta', sito web) quando l'estensione non e' disponibile. Non usa MAI il cookie della sessione autenticata.

### 4. Pipeline di acquisizione gestita dal frontend

**File**: `src/pages/AcquisizionePartner.tsx`

La pipeline cambia:
- Il frontend diventa il "motore" che orchestra il download
- Per ogni WCA ID: chiede all'estensione di aprire la pagina
- L'estensione estrae TUTTO (contatti, email, telefoni, nome azienda)
- I dati vengono salvati nel DB
- Se l'estensione non e' disponibile, il job va in pausa (non usa il server come fallback)

### 5. Download Management adattato

**File**: `src/pages/DownloadManagement.tsx` e `src/hooks/useDownloadJobs.ts`

Il Download Management continua a creare job con la lista di WCA IDs, ma il processing avviene lato frontend tramite l'estensione. Il job tiene traccia del progresso. Se il browser viene chiuso, il job resta in pausa e riprende quando il browser viene riaperto.

## Riepilogo dei file modificati

| File | Modifica |
|------|----------|
| `supabase/functions/save-wca-cookie/index.ts` | Rimuovere `testCookieDeep` — zero richieste HTTP a WCA |
| `supabase/functions/process-download-job/index.ts` | Rimuovere chiamata a `scrape-wca-partners` — il job segna solo il progresso |
| `supabase/functions/scrape-wca-partners/index.ts` | Non usa piu' il cookie dell'utente per fetch diretti |
| `src/pages/AcquisizionePartner.tsx` | L'estensione diventa il motore di scraping |
| `public/chrome-extension/background.js` | Estrarre TUTTI i dati del profilo (non solo contatti) |

## Risultato

- Tu fai login su WCA una volta sola
- L'estensione lavora nel tuo browser, stesso IP, stessa sessione
- Il server NON tocca MAI WCA con il tuo cookie
- La sessione resta attiva finche' il cookie non scade naturalmente (ore/giorni)
- Se il cookie scade, l'estensione lo ri-sincronizza automaticamente

