

# Ristrutturazione Deep Search: Eliminare Firecrawl, Unificare su Partner Connect

## Situazione Attuale

```text
Livello 1: Light (DB only) — OK, resta
Livello 2: deep-search-partner (Edge Function) — usa Firecrawl per ~15 query Google + scraping
Livello 3: deep-search-contact (Edge Function) — usa Firecrawl, quasi identico al L2
Livello 4: LinkedIn Flow (client-side) — usa estensione, on-demand
```

Problemi: Firecrawl costa, Level 3 è ridondante, Facebook/Instagram personali sono inutili per il business.

## Nuova Architettura

```text
Livello 1: Light (DB only) — invariato
Livello 2: Deep Search Standard (CLIENT-SIDE via Partner Connect)
           - LinkedIn personale + LinkedIn azienda
           - WhatsApp auto-link
           - Website scraping + logo + quality score
           - Company profile search (Google via estensione)
           - Contact profile AI (Google via estensione)
           - NO Facebook personale, NO Instagram personale
           - AI: Lovable AI Gateway (gratuito)
Livello 3: ELIMINATO (i contatti CRM usano lo stesso L2 adattato)
Livello 4: LinkedIn Flow — invariato, solo on-demand
```

## Modifiche

### 1. Riscrivere `useDeepSearchLocal.ts`
- Rimuovere blocchi Facebook personale e Instagram personale
- Mantenere: LinkedIn personale, LinkedIn azienda, WhatsApp, website scraping/logo, company profile search, contact profile AI
- Già usa Partner Connect + Lovable AI — nessun cambiamento di infrastruttura

### 2. Aggiungere supporto contatti a `useDeepSearchLocal.ts`
- Nuova funzione `searchContact(contactId)` per contatti CRM (`imported_contacts`)
- Stessa logica del partner ma legge da `imported_contacts` e salva in `enrichment_data`
- Cerca: LinkedIn personale, LinkedIn azienda, WhatsApp, website da email domain, company profile

### 3. Aggiornare `useDeepSearchRunner.ts`
- Rimuovere fallback alle edge functions Firecrawl
- Se Partner Connect non è disponibile → mostra errore "Installa Partner Connect per la Deep Search"
- Per mode `"contact"` → usa `localSearch.searchContact(id)` invece dell'edge function
- Nessun riferimento a `deep-search-partner` o `deep-search-contact` edge functions

### 4. Edge Functions — deprecate
- `deep-search-partner/index.ts`: aggiungere risposta "deprecated, usa Partner Connect"
- `deep-search-contact/index.ts`: stessa cosa
- `enrich-partner-website/index.ts`: nota deprecation (usa Partner Connect per scraping)
- Non eliminare per ora (backward compatibility) ma disabilitare

### 5. Aggiornare `plan.md`
- Riflettere la nuova architettura a 3 livelli (L1 Light, L2 Standard, L4 LinkedIn Flow on-demand)

## Dettagli Tecnici

**Ricerche per partner (L2 Standard):**
- 1-3 query Google per LinkedIn personale (per contatto)
- 1 query per LinkedIn azienda
- 1 scraping sito web (logo + quality)
- 1-2 query per company profile
- 1-2 query per contact profile AI
- WhatsApp: auto-link da telefono (zero query)
- Totale: ~5-10 operazioni Partner Connect + 3-5 chiamate AI Gateway

**Dipendenze rimosse:** Nessun import/riferimento a Firecrawl nelle operazioni Deep Search.

