

# Ottimizzazione Velocita Download: da 29s a ~5s per profilo

## Analisi del collo di bottiglia

Il tempo attuale di ~29 secondi per profilo e causato da 3 operazioni sequenziali:

| Fase | Tempo stimato | Causa |
|------|--------------|-------|
| Firecrawl con estrazione LLM | 15-20s | Usa `formats: ['extract']` che attiva un LLM lato Firecrawl per estrarre i dati |
| Analisi AI (Lovable gateway) | 5-10s | Chiamata sincrona ad `analyze-partner`, attesa completa prima di rispondere |
| Query DB sequenziali | 2-3s | Ogni certificazione, network e contatto viene verificato uno per uno |

## Strategia di ottimizzazione

### 1. Firecrawl: da `extract` a `markdown` + parsing regex (risparmio: ~12-15s)

Invece di chiedere a Firecrawl di usare un LLM per estrarre i dati (lento e costoso), scarichiamo solo il markdown della pagina e facciamo il parsing noi con regex/string matching deterministico. Questo e lo stesso approccio gia usato con successo per `scrape-wca-directory`.

- Cambiare `formats: ['extract']` in `formats: ['markdown']`
- Rimuovere `waitFor: 5000` (non serve per markdown)
- Rimuovere tutto il blocco `extract: { prompt, schema }`
- Implementare funzioni di parsing regex per estrarre: company_name, city, country, email, phone, website, address, profile_description, member_since, certifications, networks, contacts, branch_offices
- Il formato delle pagine WCA e strutturato e prevedibile, ideale per regex

### 2. Analisi AI: da sincrona a fire-and-forget (risparmio: ~5-10s)

Attualmente `scrape-wca-partners` chiama `analyze-partner` e ATTENDE la risposta prima di restituire il risultato. Questo raddoppia inutilmente il tempo.

- Cambiare la chiamata ad `analyze-partner` da `await fetch(...)` + `await response.json()` a un semplice `fetch(...).catch(...)` senza await
- L'analisi AI viene comunque eseguita in background e aggiorna il DB autonomamente
- Il profilo base e immediatamente disponibile, l'arricchimento AI arriva dopo qualche secondo

### 3. DB: da query sequenziali a batch (risparmio: ~1-2s)

- Certificazioni: invece di verificare una per una se esistono, fare un'unica query per ottenere quelle esistenti, filtrare le nuove, e inserirle tutte con un singolo `insert`
- Networks e Contacts: stessa logica batch
- Per gli update, usare `upsert` dove possibile

## Tempo stimato dopo ottimizzazione

| Fase | Tempo stimato |
|------|--------------|
| Firecrawl markdown (no LLM) | 2-3s |
| Parsing regex locale | <0.1s |
| DB batch insert/upsert | 0.5-1s |
| AI analysis (fire-and-forget) | 0s (non bloccante) |
| **Totale** | **~3-4s** |

## File da modificare

### `supabase/functions/scrape-wca-partners/index.ts`
- Sostituire la chiamata Firecrawl `extract` con `markdown`
- Aggiungere funzioni di parsing regex per tutti i campi
- Rendere la chiamata ad `analyze-partner` non bloccante (fire-and-forget)
- Batch delle query DB per certificazioni, network e contatti

### `supabase/functions/process-download-job/index.ts`
- Ridurre il `delay_seconds` di default da 10 a 3 secondi (dato che il processo e ora molto piu veloce)

## Rischi e mitigazioni

- **Parsing regex meno preciso del LLM**: le pagine WCA hanno un formato fisso e prevedibile, quindi il parsing deterministico e in realta piu affidabile. Eventuali campi non trovati vengono semplicemente lasciati null.
- **AI analysis asincrona**: il rating e il summary arriveranno qualche secondo dopo il profilo base. La UI gia gestisce campi null, quindi non ci sono problemi di visualizzazione.

