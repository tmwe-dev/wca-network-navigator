

# Fix scrape-wca-blacklist: Aggiungere autenticazione WCA

## Problema

La funzione `scrape-wca-blacklist` usa Firecrawl per scrapare la pagina blacklist, ma:
1. **Non verifica** se la sessione WCA e' attiva prima di procedere
2. **Non invia il cookie WCA** -- Firecrawl non supporta cookie custom
3. Se la pagina richiede login, restituisce dati vuoti o parziali

## Soluzione

Modificare la Edge Function per:
1. Leggere il cookie WCA da `app_settings` (come fa gia' `check-wca-session`)
2. Verificare che la sessione sia attiva prima di procedere
3. Usare `fetch` diretto con il cookie WCA invece di Firecrawl (cosi' possiamo passare l'header Cookie)
4. Se la sessione non e' attiva, restituire un errore chiaro "WCA session not active"

## Modifiche

### File: `supabase/functions/scrape-wca-blacklist/index.ts`

Riscrivere la logica di scraping:

1. Recuperare il cookie WCA da `app_settings` (chiavi `wca_auth_cookie` / `wca_session_cookie`)
2. Se non c'e' cookie, restituire errore `{ success: false, error: "WCA session not configured" }`
3. Fare un test rapido di autenticazione (come `testCookie` in check-wca-session)
4. Se la sessione e' scaduta, restituire errore `{ success: false, error: "WCA session expired" }`
5. Usare `fetch("https://www.wcaworld.com/WCAworldBlacklist", { headers: { Cookie: cookie } })` per ottenere l'HTML
6. Parsare l'HTML direttamente (tabella HTML) invece del markdown Firecrawl
7. Il resto della logica (upsert, matching, log) rimane uguale

### Riepilogo

| File | Modifiche |
|------|-----------|
| `supabase/functions/scrape-wca-blacklist/index.ts` | Rimuovere Firecrawl, aggiungere fetch con cookie WCA, verifica sessione preventiva, parsing HTML diretto |

Nessuna modifica frontend necessaria -- il componente `BlacklistManager.tsx` ricevera' l'errore e lo mostrera' all'utente.

