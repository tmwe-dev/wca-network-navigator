

# Deep Search Architecture — v2 (Partner Connect Only)

## Livelli

### Livello 1 — Light (DB Only, 0 crediti)
Legge dati esistenti da `partners`, `contacts`, `enrichment_data`. Usato da `generate-outreach` per contesto immediato.

### Livello 2 — Standard Deep Search (Client-Side via Partner Connect)
Richiede l'estensione **Partner Connect** installata nel browser.

**Cerca:**
- LinkedIn personale (per contatto) — Google search + AI validation
- LinkedIn azienda — Google search
- WhatsApp auto-link da telefono
- Website scraping + logo (Google favicon) + quality score AI
- Company profile search (Google via estensione)
- Contact profile AI (seniority, ruolo)

**NON cerca:** Facebook personale, Instagram personale.

**AI Engine:** Lovable AI Gateway (gratuito, `google/gemini-2.5-flash-lite`)

**Funziona per:** Partners (network) e Contatti CRM (imported_contacts) con la stessa logica unificata.

### Livello 4 — LinkedIn Flow (On-demand, Client-Side)
Scraping profilo LinkedIn completo, detect connection status, generazione messaggi AI personalizzati. Solo su richiesta esplicita dell'utente.

## File principali

| File | Ruolo |
|------|-------|
| `src/hooks/useDeepSearchLocal.ts` | Logica Deep Search L2 (partner + contact) |
| `src/hooks/useDeepSearchRunner.ts` | Orchestratore, richiede Partner Connect |
| `src/hooks/useFireScrapeExtensionBridge.ts` | Bridge con estensione Partner Connect |
| `supabase/functions/deep-search-partner/` | DEPRECATO (ritorna 410) |
| `supabase/functions/deep-search-contact/` | DEPRECATO (ritorna 410) |

## Dipendenze rimosse
- **Firecrawl**: non più usato per Deep Search
- **Facebook/Instagram personali**: rimossi dalla ricerca
- **Edge functions Deep Search**: deprecate, tutto client-side
