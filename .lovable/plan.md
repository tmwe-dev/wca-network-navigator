
## Piano: Restyling Icone, Fix Bandiere, Fix Bulgaria e Deep Search Avanzato

### 1. Fix bandiera triplicata
Il codice alla riga 562-564 di `PartnerHub.tsx` ripete 3 volte la stessa bandiera. Correggo mostrando **una sola bandiera** del paese accanto alla citta'.

### 2. Fix Bulgaria nella vista Paesi
La `CountryOverview` riceve i partner gia' filtrati. Se il toggle "Incompleti" e' attivo o ci sono filtri, la Bulgaria potrebbe non comparire. Passo alla `CountryOverview` l'elenco completo dei partner (non filtrato) oppure aggiungo una prop dedicata per garantire che tutti i paesi siano sempre visibili.

### 3. Icone colorate per i servizi
Sostituisco le icone monocromatiche con colori specifici per ogni servizio:

| Servizio | Colore |
|----------|--------|
| Air Freight | Azzurro cielo (#38bdf8) |
| Ocean FCL/LCL | Blu oceano (#3b82f6) |
| Road Freight | Ambra (#f59e0b) |
| Rail Freight | Grigio acciaio (#64748b) |
| Project Cargo | Viola (#8b5cf6) |
| Dangerous Goods | Rosso (#ef4444) |
| Perishables | Ciano (#06b6d4) |
| Pharma | Verde (#22c55e) |
| E-commerce | Arancione (#f97316) |
| Relocations | Rosa (#ec4899) |
| Customs | Indaco (#6366f1) |
| Warehousing | Marrone (#a16207) |
| NVOCC | Teal (#14b8a6) |

Aggiorno sia la lista card che il pannello dettaglio.

### 4. Deep Search potenziato
Espando la funzione `deep-search-partner` per cercare:

**A. Profili social aggiuntivi per ogni contatto:**
- LinkedIn personale (gia' presente)
- LinkedIn aziendale (gia' presente)
- Facebook personale
- Instagram personale

**B. Ricerca informazioni personali:**
- 2-3 ricerche web generiche per ogni responsabile (nome + azienda + citta')
- L'AI analizza i risultati e genera un mini-profilo con:
  - Background professionale
  - Interessi/hobby rilevabili
  - Lingua parlata
  - Altre aziende collegate

**C. Profilo aziendale ampliato:**
- Ricerca informazioni aggiuntive sull'azienda (premi, certificazioni, notizie recenti)

I risultati vengono salvati in:
- `partner_social_links` (per i nuovi profili social)
- `partners.enrichment_data` (per le info personali e aziendali aggiuntive)

### Dettagli tecnici

**File: `src/pages/PartnerHub.tsx`**
- Rimuovere le righe 562-564 (3 bandiere duplicate), sostituire con una sola bandiera
- Aggiornare i colori delle icone servizi da monocromatici a specifici per servizio
- Passare `partners` (non `filteredPartners`) alla CountryOverview, oppure gestire separatamente

**File: `src/lib/countries.ts`**
- Aggiornare `getServiceIconColor()` con colori specifici per ogni categoria invece del generico sky/slate

**File: `supabase/functions/deep-search-partner/index.ts`**
- Aggiungere ricerca Facebook e Instagram per ogni contatto
- Aggiungere ricerca web generica (2-3 query) per costruire il profilo personale
- Salvare il mini-profilo in `enrichment_data` o in un nuovo campo JSON
- Gestire i rate limit con delay progressivi

**File: `src/components/partners/SocialLinks.tsx`**
- Aggiungere icone SVG per Instagram e Facebook (oltre a LinkedIn gia' presente)

Nessun nuovo strumento necessario: Firecrawl (ricerca web) e l'AI gateway (analisi risultati) sono sufficienti per tutte le operazioni.
