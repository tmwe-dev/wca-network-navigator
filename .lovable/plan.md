

# Deep Search via Estensione Chrome (Client-Side)

## Situazione attuale

La Deep Search usa **Firecrawl API** (server-side, a pagamento) per cercare profili social e scraping siti web. Ogni partner costa 10-15 chiamate API Firecrawl.

## Soluzione

Creare un'estensione Chrome **FireScrape** che esegue le ricerche Google e lo scraping direttamente dal browser dell'utente. Il frontend orchestra tutto: l'estensione cerca, l'AI analizza i risultati.

```text
ATTUALE:
  Frontend → Edge Function → Firecrawl API ($$) → AI → DB

NUOVO:
  Frontend → Estensione Chrome (Google Search + Scrape) → AI Gateway → DB
  Fallback: se estensione non disponibile → Edge Function (come ora)
```

## Implementazione

### 1. Nuova estensione `firescrape-extension/`

- **manifest.json**: permessi per `*://*.google.com/*`, `*://*/*` (scraping generico)
- **background.js**: riceve comandi dal content script, apre tab in background, esegue ricerche Google, estrae risultati, scrapa pagine web (titolo, description, logo, markdown)
- **content.js**: bridge postMessage con l'app (stesso pattern LinkedIn/WhatsApp)
- Azioni supportate:
  - `search` → cerca su Google, ritorna titolo + URL + snippet per ogni risultato
  - `scrape` → apre URL in background, estrae testo, logo, metadata
  - `ping` → verifica disponibilita'

### 2. Hook `useFireScrapeExtensionBridge.ts`

Stesso pattern di `useLinkedInExtensionBridge`: postMessage, heartbeat, `isAvailable`, metodi `search(query)` e `scrape(url)`.

### 3. Nuovo hook `useDeepSearchLocal.ts`

Logica di Deep Search che gira **interamente nel frontend**:
- Per ogni partner/contatto, usa l'estensione per cercare profili LinkedIn, Facebook, Instagram
- Usa l'AI Gateway (Lovable AI, gia' disponibile lato client) per validare i risultati
- Salva direttamente nel DB via Supabase client
- Stessa logica di rating e enrichment delle edge functions attuali

### 4. Modifica `useDeepSearchRunner.ts`

- Al `start()`, controlla se l'estensione FireScrape e' disponibile
- Se si': usa `useDeepSearchLocal` (gratis, nessun costo Firecrawl)
- Se no: fallback alle edge functions attuali (Firecrawl)
- Toast indica quale motore sta usando

### 5. Indicatore in `ConnectionStatusBar.tsx`

Aggiungere icona FireScrape accanto a LinkedIn/WhatsApp con stato verde/rosso.

## File coinvolti

| File | Azione |
|------|--------|
| `public/firescrape-extension/manifest.json` | Nuovo |
| `public/firescrape-extension/background.js` | Nuovo — Google search + scrape |
| `public/firescrape-extension/content.js` | Nuovo — bridge postMessage |
| `public/firescrape-extension/popup.html` | Nuovo — popup minimale |
| `src/hooks/useFireScrapeExtensionBridge.ts` | Nuovo — bridge hook |
| `src/hooks/useDeepSearchLocal.ts` | Nuovo — Deep Search client-side |
| `src/hooks/useDeepSearchRunner.ts` | Modifica — auto-detect estensione, fallback |
| `src/components/layout/ConnectionStatusBar.tsx` | Modifica — icona FireScrape |
| `src/components/settings/ConnectionsSettings.tsx` | Modifica — sezione FireScrape |

## Vantaggi

- **Zero costi Firecrawl** quando l'estensione e' attiva
- **Nessun rate limiting server-side** — le ricerche Google sono dal browser dell'utente
- **Stealth**: l'estensione opera in tab nascosti, nessuna interazione visibile
- **Fallback automatico** alle edge functions se l'estensione non c'e'

