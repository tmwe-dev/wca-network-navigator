

## Piano: Contatore token per partner e per paese

### Problema
I token consumati durante Deep Search vengono tracciati e detratti dai crediti, ma non vengono salvati nel profilo del partner. Non c'e visibilita su quanto costa ogni singola analisi.

### Modifiche

#### 1. `supabase/functions/deep-search-partner/index.ts`
Salvare i token consumati dentro `enrichment_data` al momento del salvataggio (riga ~627-633):
```
tokens_used: {
  prompt: totalTokens.prompt,
  completion: totalTokens.completion,
  credits_consumed: inputCost + outputCost
}
```
Calcolare `credits_consumed` prima del salvataggio e includerlo nel JSON.

#### 2. `src/components/partners/EnrichmentCard.tsx`
Aggiungere una riga in fondo alla sezione Enrichment che mostri:
- Token input/output usati
- Crediti consumati
- Icona `Coins` con badge colorato (verde se < 20 crediti, ambra se 20-50, rosso se > 50)

#### 3. `src/components/partners/CountryWorkbench.tsx`
Aggiungere nell'header del paese un contatore aggregato:
- Somma `enrichment_data.tokens_used.credits_consumed` di tutti i partner del paese che hanno dati Deep Search
- Mostrare come badge compatto accanto al nome del paese (es. "⚡ 142 crediti AI")

### File da modificare
1. `supabase/functions/deep-search-partner/index.ts` — salvare `tokens_used` in `enrichment_data`
2. `src/components/partners/EnrichmentCard.tsx` — mostrare token/crediti per partner
3. `src/components/partners/CountryWorkbench.tsx` — mostrare totale crediti AI aggregato per paese

