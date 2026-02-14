

# Fix contatori paesi e aggiunta totale directory

## Problema principale

I contatori nella Country Grid usano il campo `total_results` della tabella `directory_cache` per determinare quanti partner esistono nella directory per ogni paese. Ma `total_results` contiene un numero sbagliato (es. 42 per gli USA), mentre il vero conteggio e' nel campo `members` (array JSON con 1092 elementi per gli USA).

Questo causa:
- Paesi marcati come "Completo" quando non lo sono (es. USA: 837 partner scaricati vs 42 `total_results` = marcato completo, ma la directory ne ha 1092)
- Percentuali di completamento sbagliate
- Colori e badge fuorvianti

## Modifiche

### 1. `src/components/download/CountryGrid.tsx` -- Fix query cache

Nella query `cache-data-by-country` (righe 53-70), il conteggio viene attualmente preso da `r.total_results`. Deve essere sostituito con `jsonb_array_length(members)` calcolato lato database.

Cambio nella query:
```sql
-- Attuale
.select("country_code, total_results, download_verified")

-- Nuovo: usa una RPC o calcola diversamente
```

Poiche' Supabase JS non supporta `jsonb_array_length` inline, la soluzione e' creare una view o una RPC. L'alternativa piu' semplice e' selezionare il campo `members` e calcolarne la lunghezza lato client. Ma `members` e' un array potenzialmente enorme (1000+ elementi per paese), quindi sarebbe inefficiente scaricarlo tutto.

**Soluzione scelta**: creare una database function `get_directory_counts()` che restituisce `country_code` e il conteggio corretto.

### 2. Migrazione database -- Creare funzione RPC

```sql
CREATE OR REPLACE FUNCTION get_directory_counts()
RETURNS TABLE(country_code text, member_count bigint, is_verified boolean)
LANGUAGE sql STABLE
AS $$
  SELECT 
    dc.country_code,
    SUM(jsonb_array_length(dc.members))::bigint as member_count,
    BOOL_AND(dc.download_verified) as is_verified
  FROM directory_cache dc
  GROUP BY dc.country_code;
$$;
```

### 3. `src/components/download/CountryGrid.tsx` -- Usare la nuova RPC

Sostituire la query `cache-data-by-country` per chiamare `supabase.rpc('get_directory_counts')` e mappare i risultati nello stesso formato `{ count, verified }`.

### 4. `src/pages/Operations.tsx` -- Aggiungere stat "Directory" nella barra globale

Nella barra delle statistiche globali (tra Globe/Partner/Email/Telefoni), aggiungere un nuovo indicatore:
- Icona: `FolderDown`
- Label: "In directory"
- Valore: somma di tutti i `member_count` dalla RPC (totale 13.384 attualmente)

Questo richiede una query aggiuntiva o l'utilizzo della stessa RPC gia' chiamata nella CountryGrid. Per evitare duplicazioni, il totale puo' essere calcolato sommando i valori restituiti dalla RPC nel hook `useGlobalStats`.

### 5. Verifica logica "Completo"

La riga 283 del CountryGrid:
```typescript
const isComplete = hasDirectoryScan && cCount > 0 && pCount >= cCount;
```
Questa logica diventa corretta una volta che `cCount` contiene il vero numero di membri nella directory (da `jsonb_array_length(members)`) anziche' il valore errato di `total_results`.

## Riepilogo impatto

| Elemento | Prima | Dopo |
|----------|-------|------|
| USA | 837/42 = "Completo" | 837/1092 = 77% |
| India | 3/3 = "Completo" | 3/1253 = 0.2% |
| Argentina | 92/54 = "Completo" | 92/(vero totale) = corretto |
| Barra globale | 4 indicatori | 5 indicatori (+ "In directory") |

## File modificati

1. **Migrazione SQL**: nuova funzione `get_directory_counts()`
2. **`src/components/download/CountryGrid.tsx`**: query usa RPC invece di `total_results`
3. **`src/pages/Operations.tsx`**: aggiunto indicatore "In directory" nella barra globale

