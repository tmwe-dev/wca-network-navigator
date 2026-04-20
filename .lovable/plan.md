

## Verifica fatta sul DB

Ho interrogato il database reale e ho trovato i numeri **veri**:

| Sorgente | Vero count | Mostrato in Settings | Stato |
|---|---|---|---|
| Partners WCA | **12.286** | 1.000 | ❌ cap |
| Contatti importati | **11.414** | 1.000 | ❌ cap |
| BCA | 383 | 383 | ✅ ok |
| Email senders | 7.468 msg | ? | ❌ cap |
| **Partner con LinkedIn slug** | **0** | — | mai compilato! |
| Logo partner | 1.310 / 12.286 | — | 89% mancante |

**Causa del bug "1000"**: il loader `loadAllRows` in `useEnrichmentData.ts` chiama `range(0, 1999)` ma Supabase applica un hard cap implicito di 1000 quando non passi esplicitamente `limit`. Risultato: prende 1000, vede `data.length < batchSize`, esce, conteggi sbagliati.

**Da quali tabelle prende oggi**: `partners`, `imported_contacts`, `business_cards`, `channel_messages` (per email senders), `cockpit_queue`. Tutte corrette ma cappate.

---

## Piano in 2 fasi (faccio tutto, niente più conferme)

### Fase A — FIX contatori reali e loader (15 min)

1. **`useEnrichmentData.ts`**: sostituire `loadAllRows` con paginazione esplicita `.limit(1000)` per pagina e ciclo finché `data.length === 1000`. Aggiungere parametro deleted_at IS NULL su tutte le tabelle business.
2. **`SourceTabBar`**: i count mostrati saranno quelli reali (12.286 / 11.414 / 383 / N email).
3. **Test**: dopo il fix, il tab "Tutti" deve mostrare ~31.000 righe totali (12286 + 11414 + 383 + email senders unici).

### Fase B — Nuovo job "Arricchimento Base" (zero costo, background)

Implementazione di un **pre-fill batch** che NON tocca LinkedIn né AI, solo Google search pubblica + scraping pubblico. Esegue per ogni record selezionato (o "tutti i mancanti"):

| Step | Cosa fa | Costo | Salva su |
|---|---|---|---|
| 1. Slug LinkedIn azienda | Google `site:linkedin.com/company "Azienda"` | 0 | `partners.enrichment_data.linkedin_url` |
| 2. Slug LinkedIn persona (solo contatti) | Google `site:linkedin.com/in "Nome" "Azienda"` | 0 | `imported_contacts.enrichment_data.linkedin_url` |
| 3. Logo azienda | Clearbit `logo.clearbit.com/{domain}` con fallback Google Favicon | 0 | `partners.logo_url` |
| 4. Mini-scrape sito (homepage + /about + /contact) | fetch HTML pubblico, regex per email/telefono/descrizione | 0 | `partners.enrichment_data.website_excerpt` |

**Vincoli operativi**:
- Throttle Google: 1 req/sec globale (riusa `rateLimiter.ts` esistente)
- Throttle siti: 1 req/sec per dominio
- Concorrenza: 3 worker paralleli (perché ogni worker gira su domini diversi)
- Resume: salva l'ID dell'ultimo record processato in `localStorage`, ripartenza automatica
- Idempotente: skip dei record già arricchiti (campo già pieno)
- **Zero LinkedIn hits** (solo Google), zero AI calls
- Sherlock/Deep Search restano on-demand e separati

**UI nella pagina Arricchimento**:
- Nuovo pulsante "🚀 Arricchimento Base (background)" in `EnrichmentBatchActions.tsx`
- Barra progresso con: progresso/totale, slug trovati, loghi trovati, siti letti, errori
- Pulsante Stop, indicatori per riga (✓ slug ✓ logo ✓ sito)
- Lavora **anche in background** (l'utente può navigare via, riparte alla riapertura)

**File toccati**:
- `src/hooks/useEnrichmentData.ts` (fix loader + count exact)
- `src/v2/services/enrichment/baseEnrichment.ts` (nuovo) — engine
- `src/hooks/useBaseEnrichment.ts` (nuovo) — orchestrazione UI + persistenza progresso
- `src/components/settings/enrichment/BulkActionBar.tsx` — aggiungo pulsante
- `src/components/settings/enrichment/EnrichmentRowList.tsx` — indicatori per riga
- `src/data/partners.ts` + `src/data/contacts.ts` — funzione `updateEnrichmentBase()`

**Cosa NON faccio (esplicito)**:
- Niente nuove tabelle DB, riuso colonne esistenti (`enrichment_data` JSONB già presente)
- Niente edge function nuove, tutto client-side (così sfrutto il bridge browser per i fetch e il throttle è autoritativo)
- Niente modifiche a Sherlock/Deep Search, restano separati
- Niente login LinkedIn

---

## Risultato atteso

1. Contatori in pagina = 12.286 partner + 11.414 contatti + 383 BCA (numeri reali, non cap).
2. Pulsante "Arricchimento Base" che gira in background e in pochi giorni avrà popolato `linkedin_url`, `logo_url` e `website_excerpt` su quasi tutti i 12.286 partner senza spendere un solo token AI e senza un solo hit a LinkedIn.
3. Quando poi si lancia Sherlock su un partner, troverà già LinkedIn e info sito → spesso non servirà nemmeno fare deep search.

