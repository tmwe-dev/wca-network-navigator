

# Creare Edge Function sync-wca-partners

## Situazione

- Il pulsante "Sincronizza WCA" nell'header chiama `sync-wca-partners` — ma **la funzione non esiste**
- Il DB locale ha 12.193 partner ma **zero con raw_profile_html/markdown** — i profili completi sono sul DB esterno (`dlldkrzoxvjxpgkkttxu`)
- Il pattern è già stabilito da `sync-business-cards`: connessione a DB esterno → lettura paginata → upsert locale

## Piano

### 1. Creare `supabase/functions/sync-wca-partners/index.ts`

Edge function che:
- Riceve `{ countryCode }` dal frontend
- Si connette al DB esterno via `WCA_EXTERNAL_SUPABASE_KEY`
- Legge dalla tabella `partners` esterna filtrando per `country_code`, con paginazione da 500
- Per ogni partner: upsert su `partners` locale usando `wca_id` come chiave univoca
- Sincronizza anche `partner_contacts` e `partner_networks` associati
- Usa SSE per streaming del progresso in tempo reale (come richiesto dalla memoria)
- Mappa i campi pre-calcolati (`country_name`, `city`, `member_since`) direttamente
- Fallback prioritario per `direct_phone`: `direct_phone` → `direct_line` → `phone` → `mobile`

### 2. Aggiornare il frontend in `Operations.tsx`

- Il `handleSyncWca` attuale fa un semplice `invoke` — va adattato per leggere lo stream SSE e mostrare progresso (toast con conteggio)

## File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/sync-wca-partners/index.ts` | **Nuovo** — Edge Function cloud-to-cloud sync |
| `src/pages/Operations.tsx` | Adattare handleSyncWca per SSE streaming |

## Risultato

Cliccando "Sincronizza WCA" con un paese selezionato, tutti i profili completi vengono scaricati dal DB esterno al locale, con progresso in tempo reale. I 12.193 partner si arricchiscono di profili, contatti, network.

