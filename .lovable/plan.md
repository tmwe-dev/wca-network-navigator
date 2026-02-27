

## Problema: contatori non aggiornati dopo download

Il processore di download (`useDownloadProcessor.ts`) invalida diverse query al completamento di un job, ma **non invalida la query `country-stats`** usata dai contatori del dashboard in Operations. Dopo aver scaricato i 3 profili dell'Afghanistan, i dati della RPC `get_country_stats()` restano nella cache React Query e mostrano i valori precedenti (zero).

## Soluzione

Aggiungere `queryClient.invalidateQueries({ queryKey: ["country-stats"] })` in due punti di `useDownloadProcessor.ts`:

1. **Nella invalidazione periodica** (ogni 5 profili processati, riga ~258): aggiungere `country-stats` accanto a `contact-completeness` e `partner-counts-by-country-with-type`
2. **Nella cleanup finale** (riga ~281): aggiungere `country-stats` accanto alle altre query invalidate al termine del job

### File modificato
- `src/hooks/useDownloadProcessor.ts` -- 2 righe aggiunte

