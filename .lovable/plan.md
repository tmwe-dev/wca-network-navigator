

# Piano: Integrazione API Vercel WCA nel Sistema di Scraping

## Obiettivo

Sostituire Firecrawl come canale primario con le API Vercel (`https://wca-app.vercel.app/api`) per directory listing e profile scraping. Le credenziali WCA sono gia' salvate nella tabella `user_wca_credentials` (per-user) e vengono lette dalla edge function `get-wca-credentials`.

## Flusso

```text
Edge Function → Vercel /api/login (con credenziali da user_wca_credentials)
             → Vercel /api/discover (lista membri per paese)
             → Vercel /api/scrape (profilo singolo)
             → Se fallisce → Fallback a Firecrawl/Direct fetch (attuale)
```

## Modifiche

### 1. `supabase/functions/scrape-wca-directory/index.ts`

**Canale primario: Vercel API**
- Leggere credenziali WCA dal DB (`user_wca_credentials` via service role, usando lo user_id dal JWT)
- `POST /api/login` con username/password → ottieni cookie
- `POST /api/discover` con country, page, cookie → lista membri con `id`, `company_name`, `city`
- Mappare il formato Vercel al formato esistente (`{ company_name, city, wca_id }`)
- Se Vercel fallisce (timeout, errore, 0 risultati) → fallback a Firecrawl (codice attuale)

### 2. `supabase/functions/scrape-wca-partners/index.ts`

**Canale primario: Vercel API (prima di direct fetch)**
- Leggere credenziali WCA dal DB
- `POST /api/login` → cookie
- `POST /api/scrape` con `memberId` e cookie → profilo completo
- Mappare i campi Vercel al formato `parseProfileFromContent` esistente (company_name, city, email, phone, website, contacts, networks)
- Se Vercel restituisce dati validi → passare a `saveAndRespond()` come gia' fa
- Se fallisce → fallback al flusso attuale (direct fetch con cookie + Firecrawl)

### 3. Cache del cookie Vercel

Per evitare login ripetuti:
- Dopo un login Vercel riuscito, salvare il cookie in `app_settings` con key `vercel_wca_cookie` e timestamp
- Prima di ogni chiamata, controllare se il cookie cached e' < 1 ora → riusarlo
- Se scaduto o assente → nuovo login

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/scrape-wca-directory/index.ts` | Aggiungere Vercel come canale primario, Firecrawl come fallback |
| `supabase/functions/scrape-wca-partners/index.ts` | Aggiungere Vercel `/api/scrape` come primo tentativo |

Nessun secret aggiuntivo necessario — le credenziali WCA sono gia' nel DB. Nessuna modifica frontend.

