

# Bug: Contatori a zero - Causa e Soluzione

## Causa principale

Le stats (Profili, Deep Search, Email, Telefono, Alias) sono calcolate **client-side** (righe 288-300 di `PartnerListPanel.tsx`) iterando su `partners` restituiti da `usePartners()`. Questa query usa il default Supabase di **1000 righe massimo**. La Thailandia ha migliaia di partner, quindi:

1. `usePartners({ countries: ["TH"] })` restituisce solo i primi 1000
2. I contatori sono calcolati su 1000 partner invece che su tutti
3. Peggio: se il campo `raw_profile_html` e' `null` per i primi 1000 risultati (ordinati per nome), il contatore "Profili" mostra 0 anche se i profili esistono per partner con nomi successivi

## Soluzione

Usare la funzione RPC `get_country_stats()` gia' esistente (aggregazione server-side, nessun limite di righe) per i contatori del dashboard, ed estenderla per includere i campi mancanti (deep search, alias azienda, alias contatto).

### 1. Estendere `get_country_stats()` con nuovi campi

Aggiungere alla funzione SQL:
- `with_deep_search` (count partner con `enrichment_data->>'deep_search_at'` non null)
- `with_company_alias` (count partner con `company_alias` non null)
- `with_contact_alias` (count partner che hanno almeno un contatto con `contact_alias` non null)

### 2. Aggiornare `useCountryStats.ts`

Aggiungere i nuovi campi all'interfaccia `CountryStats` e al parsing dei risultati.

### 3. Sostituire stats client-side in `PartnerListPanel.tsx`

- Importare `useCountryStats()`
- Estrarre `statsData.byCountry[countryCode]` per il paese attivo
- Usare questi valori server-side per il dashboard (DashCell) invece di `stats` calcolati client-side
- Mantenere il calcolo client-side solo per il filtro della lista (progressFilter), che opera sui 1000 partner visibili

### File modificati

1. **Migrazione SQL**: Estendere `get_country_stats()` con `with_deep_search`, `with_company_alias`, `with_contact_alias`
2. **`src/hooks/useCountryStats.ts`**: Aggiungere i nuovi campi
3. **`src/components/operations/PartnerListPanel.tsx`**: Usare `useCountryStats()` per i contatori dashboard invece del calcolo client-side

