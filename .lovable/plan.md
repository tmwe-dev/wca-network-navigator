

# Piano: Eliminare Firecrawl e Riorganizzare il Sistema di Ricerca

## Stato Attuale

Firecrawl e' ancora presente in **6 edge functions** e **3 file frontend**. Il sistema LinkedIn ha 2 hook duplicati (`useSmartLinkedInSearch` + `useLinkedInLookup`). La Deep Search locale (`useDeepSearchLocal`, 541 righe) usa gia Partner Connect ma e' monolitica e non permette all'utente di scegliere cosa cercare.

## Architettura Target

```text
┌─────────────────────────────────────────────────┐
│  RICERCA LINKEDIN (Google-only)                 │
│  useLinkedInLookup.ts (unificato)               │
│  - Batch: cerca su Google → salva URL           │
│  - Single: stessa logica, 1 contatto            │
│  - Zero fallback LinkedIn people search         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  DEEP SEARCH (opzionale, popup con flags)       │
│  DeepSearchOptionsDialog.tsx                    │
│  ☑ Sito web aziendale                           │
│  ☑ Profilo LinkedIn (scrape leggero)            │
│  ☑ WhatsApp                                     │
│  ☐ Analisi AI del profilo                       │
│  [Avvia] [Annulla]                              │
└─────────────────────────────────────────────────┘
```

## Step 1 — Eliminare Edge Functions Firecrawl

**Eliminare completamente:**
- `supabase/functions/firecrawl-search/index.ts`

**Rimuovere codice Firecrawl da:**
- `supabase/functions/enrich-partner-website/index.ts` — rimuovere blocchi `FIRECRAWL_API_KEY`, far fallire gracefully se non c'e Partner Connect
- `supabase/functions/generate-outreach/index.ts` — rimuovere 2 blocchi Firecrawl scrape (website + LinkedIn), usare solo dati gia salvati nel DB
- `supabase/functions/generate-email/index.ts` — rimuovere blocco scrape reference_urls via Firecrawl
- `supabase/functions/scrape-wca-directory/index.ts` — rimuovere `firecrawlFallback()`
- `supabase/functions/scrape-wca-partners/index.ts` — rimuovere 2 blocchi fallback Firecrawl

## Step 2 — Unificare la Ricerca LinkedIn

**Eliminare:** `src/hooks/useSmartLinkedInSearch.ts`

**Refactorizzare:** `src/hooks/useLinkedInLookup.ts` diventa l'unico hook:
- Metodo `searchSingle(contact)` — per il cockpit, 1 contatto
- Metodo `lookupBatch(contactIds)` — per completamento massivo
- Strategia: SOLO Google via Partner Connect (`pcBridge.googleSearch`)
- Rimuovere completamente il fallback LinkedIn People Search
- Scoring e matching via `src/lib/linkedinSearch.ts` (invariato)
- Salva `linkedin_profile_url` in `enrichment_data`

**Aggiornare i consumer:**
- `src/pages/Cockpit.tsx` — sostituire `useSmartLinkedInSearch` con il nuovo `useLinkedInLookup.searchSingle()`
- `src/pages/TestLinkedInSearch.tsx` — aggiornare import
- `src/components/cockpit/AISearchMonitor.tsx` — aggiornare tipo `SearchLogEntry`

## Step 3 — Deep Search con Popup Opzionale

**Nuovo componente:** `src/components/deep-search/DeepSearchOptionsDialog.tsx`
- Dialog modale con checklist:
  - ☑ Sito web aziendale (scrape via Partner Connect)
  - ☑ Profilo LinkedIn (scrape leggero se URL presente)
  - ☑ Numero WhatsApp
  - ☑ Analisi AI del profilo
- Pulsante "Avvia Deep Search"
- Usato dal Cockpit, PartnerHub, Operations, Workspace

**Refactorizzare:** `src/hooks/useDeepSearchLocal.ts`
- Accettare parametro `options: { website: boolean, linkedin: boolean, whatsapp: boolean, aiAnalysis: boolean }`
- Eseguire solo le sezioni selezionate
- Nessun uso di Firecrawl

**Aggiornare:** `src/hooks/useDeepSearchRunner.ts`
- Passare le opzioni dalla dialog al local search

## Step 4 — Pulizia Riferimenti Testuali

- `src/pages/Guida.tsx` — rimuovere menzione "Firecrawl"
- `src/data/operationsProcedures.ts` — rimuovere menzione "Firecrawl"
- `src/components/settings/BlacklistManager.tsx` — aggiornare testo
- `supabase/functions/ai-assistant/index.ts` — rimuovere menzione "Firecrawl" dal system prompt

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/firecrawl-search/` | **ELIMINARE** |
| `supabase/functions/enrich-partner-website/index.ts` | Rimuovere Firecrawl |
| `supabase/functions/generate-outreach/index.ts` | Rimuovere Firecrawl |
| `supabase/functions/generate-email/index.ts` | Rimuovere Firecrawl |
| `supabase/functions/scrape-wca-directory/index.ts` | Rimuovere fallback |
| `supabase/functions/scrape-wca-partners/index.ts` | Rimuovere fallback |
| `supabase/functions/ai-assistant/index.ts` | Pulizia testo |
| `src/hooks/useSmartLinkedInSearch.ts` | **ELIMINARE** |
| `src/hooks/useLinkedInLookup.ts` | Unificare, aggiungere `searchSingle` |
| `src/hooks/useDeepSearchLocal.ts` | Aggiungere parametro opzioni |
| `src/hooks/useDeepSearchRunner.ts` | Passare opzioni |
| `src/components/deep-search/DeepSearchOptionsDialog.tsx` | **NUOVO** |
| `src/pages/Cockpit.tsx` | Aggiornare import |
| `src/pages/TestLinkedInSearch.tsx` | Aggiornare import |
| `src/components/cockpit/AISearchMonitor.tsx` | Aggiornare tipo |
| `src/pages/Guida.tsx` | Pulizia testo |
| `src/data/operationsProcedures.ts` | Pulizia testo |
| `src/components/settings/BlacklistManager.tsx` | Pulizia testo |

## Risultato

- Zero dipendenze Firecrawl in tutto il progetto
- Un solo hook per la ricerca LinkedIn (Google-only)
- Deep Search opzionale con popup che permette all'utente di scegliere cosa cercare prima di ogni invio

