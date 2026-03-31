

# Analisi Completa della Pipeline AI Outreach

## Stato Attuale — Cosa usa e cosa NO

### Due Edge Function separate per due flussi diversi:

**`generate-email`** (Workspace — batch email):
| Dato | Usato? | Note |
|------|--------|------|
| Profilo mittente (KB, tono, ruolo) | ✅ | Da `app_settings` |
| Sales Knowledge Base (SKB) | ✅ | Sliced per quality |
| Goal + Proposta base (Mission) | ✅ | Passati dal frontend |
| Documenti workspace | ✅ | Solo standard/premium |
| Link di riferimento (Firecrawl scrape) | ✅ | Solo premium |
| Profilo partner WCA (descrizione, markdown) | ✅ | Troncato per quality |
| Network condivisi | ✅ | Da `partner_networks` |
| Servizi partner | ✅ | Solo standard/premium |
| Social links (LinkedIn URL) | ✅ | Solo premium, ma **solo l'URL**, non scrapa il contenuto |
| Alias auto-generati | ✅ | |
| **History interazioni** | ❌ | **NON consultata** |
| **Deep Search data salvata** | ❌ | **NON consultata** |
| **Post LinkedIn** | ❌ | **NON scrapati** |
| **Sito aziendale destinatario** | ❌ | **NON scrapato** |

**`generate-outreach`** (Cockpit — singolo drag):
| Dato | Usato? | Note |
|------|--------|------|
| Profilo mittente (KB, tono) | ✅ | |
| Sales KB | ✅ | Sliced |
| Goal + Proposta | ✅ | |
| Intelligence DB (partner, networks, servizi, CRM) | ✅ | Aggiunto di recente |
| **History interazioni** | ❌ | **NON consultata** |
| **Deep Search data** | Parziale | Solo `deep_search_summary` da `enrichment_data` |
| **Post LinkedIn** | ❌ | |
| **Sito aziendale** | ❌ | |
| **Documenti workspace** | ❌ | Non passati dal Cockpit |

### Cosa manca in entrambi:
1. **History interazioni** — le email/chiamate precedenti non vengono considerate (rischio di ripetere lo stesso messaggio)
2. **Scraping sito aziendale** — il website è nel DB ma non viene letto
3. **Scraping LinkedIn** — solo l'URL è salvato, nessun contenuto viene estratto
4. **Persistenza dati scrapati** — se si scrapa, i dati vanno salvati nel DB per le volte successive

---

## Piano di Implementazione: Outreach Intelligence Layer

### Strategia costi

```text
SINGOLO (Cockpit drag):     Scrape sito + LinkedIn (se premium) → salva nel DB
BATCH (Workspace genera):   Solo dati già in DB (no scraping live per costi)
SUCCESSIVI:                 Usa dati cached, scrape solo se > 30 giorni
```

### 1. Arricchire `generate-outreach` (Cockpit — singolo)

In `supabase/functions/generate-outreach/index.ts`:

- **Query history**: `SELECT * FROM interactions WHERE partner_id = X ORDER BY interaction_date DESC LIMIT 5` — iniettare nel prompt come "STORIA INTERAZIONI" per evitare ripetizioni
- **Query activities completate**: `SELECT email_subject, sent_at FROM activities WHERE source_id = X AND status = 'completed' LIMIT 5` — mostrare cosa è già stato inviato
- **Scrape sito aziendale** (se `website` esiste e `enrichment_data.website_scraped_at` è null o > 30 giorni): Firecrawl scrape → salva summary in `enrichment_data.website_summary`
- **Scrape LinkedIn** (solo premium, singolo): se il social link LinkedIn esiste, Firecrawl scrape → salva in `enrichment_data.linkedin_summary` con `linkedin_scraped_at`
- **Salvare tutto** nel record partner/contatto per riuso futuro

### 2. Arricchire `generate-email` (Workspace — batch)

In `supabase/functions/generate-email/index.ts`:

- **Query history**: stessa logica, `interactions` + `activities` completate per quel partner
- **Usare dati cached**: leggere `enrichment_data.website_summary` e `linkedin_summary` se già presenti (da Deep Search o scraping precedente)
- **NO scraping live** nel batch per contenere i costi

### 3. Persistenza dati scrapati

Salvare in `partners.enrichment_data` (JSONB già esistente):
```json
{
  "website_summary": "...",
  "website_scraped_at": "2026-03-31T...",
  "linkedin_summary": "...",
  "linkedin_scraped_at": "2026-03-31T...",
  "deep_search_summary": "...",
  "deep_search_at": "..."
}
```

Per contatti importati, salvare in `imported_contacts.enrichment_data`.

### 4. Aggiornare tab Sources (AIDraftStudio)

Aggiungere nel tab Sources:
- Sezione **"Storia Interazioni"**: quante interazioni trovate, ultima data
- Sezione **"Website"**: scraped/cached/non disponibile, con data
- Sezione **"LinkedIn"**: scraped/cached/non disponibile
- Indicazione costo stimato dell'operazione

### 5. Aggiornare `_debug` response

Estendere con:
- `interaction_history_count`: numero interazioni trovate
- `website_source`: "cached" | "live_scraped" | "not_available"
- `linkedin_source`: "cached" | "live_scraped" | "not_available"
- `estimated_cost`: crediti stimati

## File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/generate-outreach/index.ts` | History + website scrape + LinkedIn scrape + salvataggio |
| `supabase/functions/generate-email/index.ts` | History + dati cached |
| `src/components/cockpit/AIDraftStudio.tsx` | Tab Sources esteso |
| `src/hooks/useOutreachGenerator.ts` | Interfaccia debug estesa |

## Costo stimato per operazione

| Operazione | Crediti AI | Firecrawl |
|------------|-----------|-----------|
| Outreach singolo (fast) | ~3 | 0 |
| Outreach singolo (standard) | ~8 | 0 |
| Outreach singolo (premium) | ~15 | 1-2 crediti FC |
| Batch email (fast) × 20 | ~60 | 0 |
| Batch email (premium) × 20 | ~300 | 0 (usa cache) |

