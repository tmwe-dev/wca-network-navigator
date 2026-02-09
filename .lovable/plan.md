

# WCA Browser integrato + Scraping diretto (senza Firecrawl)

## Problema

Il cookie di sessione salvato contiene solo tracking cookies (Google Analytics, HubSpot), non il cookie di autenticazione `.ASPXAUTH`. Firecrawl inoltre usa i propri IP/fingerprint, quindi anche passando cookie corretti il sito WCA li rifiuta. Risultato: tutti i contatti risultano "Members only".

## Soluzione in 2 parti

### Parte 1: Scraping diretto dalla Edge Function

Eliminare Firecrawl dal flusso principale e fare login + fetch direttamente dal server:

```text
FLUSSO ATTUALE (non funziona):
  Settings cookie -> Firecrawl(url + cookie) -> WCA rifiuta -> "Members only"

NUOVO FLUSSO:
  Edge function -> Login HTTP diretto -> Cookie .ASPXAUTH -> fetch() pagina -> HTML completo
```

Passaggi del login diretto:
1. GET wcaworld.com/Account/Login -- prende token anti-CSRF e cookie iniziali
2. POST /Account/Login con username, password, token -- riceve cookie .ASPXAUTH
3. GET /directory/members/{id} con .ASPXAUTH -- pagina completa con contatti
4. Cookie .ASPXAUTH viene salvato in DB (app_settings chiave `wca_auth_cookie`) per riuso
5. Se il cookie salvato risulta scaduto (pagina contiene "Members only"), rifà login automaticamente

Firecrawl resta come fallback solo se il login diretto fallisce completamente.

### Parte 2: WCA Preview nel frontend

Un pannello "WCA Browser" accessibile dalla pagina Download Management che permette di:
- Inserire un WCA ID e vedere in anteprima cosa scarica il sistema
- Mostra stato autenticazione: "Autenticato" (verde) o "Non autenticato" (rosso)
- Mostra i dati estratti: contatti trovati, email, telefoni
- Mostra l'HTML raw della pagina per debug
- Pulsante "Test connessione" che verifica se il login funziona

## Dettagli tecnici

### File: `supabase/functions/scrape-wca-partners/index.ts`

Modifiche al main handler:
- Nuova funzione `directLogin()`: esegue login HTTP, restituisce cookie .ASPXAUTH
- Nuova funzione `directFetch(url, cookies)`: fetch diretto della pagina con cookie di sessione
- Cache cookie: dopo login riuscito, salva `wca_auth_cookie` in app_settings
- Verifica post-fetch: se HTML contiene "Members only" nei contatti, cookie scaduto, rifà login
- Firecrawl diventa fallback opzionale

### Nuovo endpoint: modalita' `preview`

Lo stesso edge function accetta un parametro `preview: true` che restituisce anche l'HTML raw e i metadati di autenticazione nella risposta, per il pannello WCA Browser.

### File: `src/pages/DownloadManagement.tsx`

Aggiunta di un pannello "WCA Browser" con:
- Input per WCA ID
- Pulsante "Anteprima" che chiama l'edge function con `preview: true`
- Visualizzazione dello stato auth (badge verde/rosso)
- Tabella dei contatti estratti con evidenziazione email/telefono
- Area espandibile con HTML raw per debug
- Pulsante "Test Login" che verifica le credenziali

### File: `src/lib/api/wcaScraper.ts`

Nuova funzione `previewWcaProfile(wcaId)` che chiama l'edge function in modalita' preview.

