

# Fix Modalita' "Profili Mancanti" nel Download

## Problema

Quando selezioni 31 paesi e vai al download, la modalita' "Profili mancanti" non funziona correttamente. Il codice attuale ha due difetti:

1. **Nessuna query per sapere QUALI partner non hanno profilo** -- la query `dbPartners` non scarica il campo `raw_profile_html`, quindi il sistema non sa quali partner specifici mancano di profilo
2. **Logica filtro rotta** -- il codice `existingIds.filter(() => noProfileCount > 0)` e' un booleano costante: se c'e' anche un solo partner senza profilo tra tutti i paesi, include TUTTI i partner esistenti nel download

## Soluzione

### File: `src/components/download/ActionPanel.tsx`

**1. Aggiungere query leggera per i wca_id senza profilo**

Una nuova query React Query che scarica SOLO i `wca_id` (numeri interi, pochi KB) dei partner che non hanno `raw_profile_html`:

```
SELECT wca_id FROM partners 
WHERE country_code IN (...) 
AND wca_id IS NOT NULL 
AND raw_profile_html IS NULL
```

Questo evita di scaricare l'intero HTML (che puo' pesare 10-50KB per partner).

**2. Correggere la logica `idsToDownload`**

Creare un Set `noProfileWcaSet` dalla query sopra e usarlo per filtrare:
- Modalita' "no_profile": include solo i partner nella directory che sono nel Set (senza profilo) PIU' quelli completamente nuovi (non ancora nel DB)
- Le altre modalita' restano invariate

**3. Aggiornare il conteggio nel Select dropdown**

Il conteggio mostrato accanto a "Profili mancanti" sara' calcolato dall'intersezione tra la directory e il Set reale, non piu' dal valore aggregato dell'RPC (che conta tutti i partner nel DB, anche quelli fuori dalla directory selezionata).

### Risultato

Selezionando "Profili mancanti" dal dropdown, il sistema scarichera' SOLO i partner che effettivamente non hanno il profilo HTML, saltando quelli gia' completi. Il conteggio mostrera' il numero esatto di partner da ri-scaricare.

