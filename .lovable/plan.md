

# Fix Sincronizzazione Business Cards

## Problema

La Edge Function `sync-business-cards` cerca la tabella `business_cards` nel database esterno, ma la tabella si chiama **`wca_business_cards`**. Errore dai log:

```
hint: "Perhaps you meant the table 'public.wca_business_cards'"
```

## Soluzione

### `supabase/functions/sync-business-cards/index.ts`

1. Cambiare la query esterna da `.from("business_cards")` a `.from("wca_business_cards")`
2. Adattare il mapping dei campi — i nomi colonna nel DB esterno potrebbero differire (verificare dopo il fix)
3. Rimuovere il limite di 1000 record (o paginare) per catturare tutte le 383+ card

### Dopo il deploy

- Lanciare la sync e verificare quante card arrivano
- Confrontare il totale con le 296 attuali nel DB locale
- Verificare che il trigger `match_business_card` si attivi correttamente sulle nuove card

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/sync-business-cards/index.ts` | Cambiare nome tabella esterna da `business_cards` a `wca_business_cards`, adattare mapping campi |

