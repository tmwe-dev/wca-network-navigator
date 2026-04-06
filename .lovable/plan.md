

# Usare lo scraper client-side per l'enrichment dei partner

## Problema attuale

La edge function `enrich-partner-website` fa un `fetch()` server-side grezzo e poi strappa l'HTML con regex (`replace(/<script>...`, `replace(/<[^>]+>/g, " ")`). Questo produce contenuto di pessima qualità: niente JavaScript rendering, niente SPA, blocchi anti-bot, e spesso meno di 50 caratteri utili.

Abbiamo già FireScrape/Partner Connect che dal browser dell'utente può estrarre markdown pulito, renderizzato, con metadati — molto superiore.

## Soluzione

Separare le due fasi: **scraping dal client** (estensione) → **analisi AI dal server** (edge function).

### Flusso nuovo

```text
Client (browser utente)
  1. FireScrape scrapeUrl(website) → markdown + metadata
  2. Chiama edge function con { partnerId, markdown, sourceUrl }

Edge Function (enrich-partner-website)
  3. Se riceve markdown nel body → usa quello (skip fetch)
  4. Se NON riceve markdown → fallback al fetch server-side (compatibilità)
  5. Analisi AI con Gemini → salva enrichment_data
```

### Intervento 1 — Edge function: accettare markdown pre-scraped
**File: `supabase/functions/enrich-partner-website/index.ts`**

- Aggiungere al body opzionale `markdown` e `sourceUrl`
- Se `markdown` è presente e lungo >50 chars, saltare il blocco fetch e usare direttamente quello
- Se non presente, mantenere il fallback fetch attuale (retrocompatibilità)

### Intervento 2 — AdvancedTools: scraping client-side prima dell'invio
**File: `src/components/download/AdvancedTools.tsx`**

- Importare `useFireScrapeExtensionBridge`
- Nel loop `handleRun`, prima di invocare la edge function:
  - Se FireScrape è disponibile → `scrapeUrl(website)` → passare il markdown nel body
  - Se FireScrape non disponibile → invocare come oggi (fallback server-side)

### Intervento 3 — AcquisitionPipeline: stessa logica
**File: `src/hooks/useAcquisitionPipeline.tsx`**

- Nel blocco `includeEnrich` (riga ~396), se FireScrape bridge è disponibile nel contesto, fare lo scrape client-side prima di chiamare la edge function
- Passare `{ partnerId, markdown, sourceUrl }` nel body

## File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/enrich-partner-website/index.ts` | Accettare `markdown` opzionale nel body, skip fetch se presente |
| `src/components/download/AdvancedTools.tsx` | Scraping via FireScrape prima dell'invio, con fallback |
| `src/hooks/useAcquisitionPipeline.tsx` | Stesso pattern: scrape client → invio markdown |

## Risultato atteso

L'AI riceve markdown di qualità reale (pagina renderizzata dal browser) invece di HTML strippato. Zero urgenza, lo scraping avviene uno alla volta con pausa tra i partner. Se l'estensione non è attiva, tutto continua a funzionare come prima con il fetch server-side.

