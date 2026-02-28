

## Diagnosi: Contatore "Senza Profilo" Thailandia

### Problema Riscontrato

Il contatore e' **tecnicamente corretto**: tutti i 178 partner della Thailandia hanno `raw_profile_html = NULL` nel database. Tuttavia hanno:
- 267 contatti salvati in `partner_contacts`
- 152/178 con Deep Search completata
- 100/178 con email, 76 con telefono
- 100/178 con company alias e contact alias

I partner TH sono stati creati il 20 Feb 2026 tramite scraping individuale (uno ogni ~20s), **non** tramite il pipeline standard di download job. Il codice path usato non ha salvato il campo `raw_profile_html`, che e' l'unico campo usato dalla funzione SQL `get_country_stats()` per determinare "con profilo" vs "senza profilo".

Globalmente ci sono **184 partner** con Deep Search fatta ma senza `raw_profile_html`.

### Soluzione Proposta

Due interventi complementari:

1. **Fix dati esistenti**: Migration SQL one-shot per impostare `raw_profile_html` a un valore segnaposto (es. `'<scraped-without-html>'`) per tutti i partner che hanno contatti O enrichment data ma `raw_profile_html` nullo. Questo corregge immediatamente i contatori per TH e tutti gli altri paesi con lo stesso problema.

2. **Prevenzione futura**: Aggiornare la logica in `get_country_stats()` per considerare un partner "con profilo" se ha `raw_profile_html IS NOT NULL` **OPPURE** ha almeno un contatto in `partner_contacts` **OPPURE** ha `enrichment_data->>'deep_search_at' IS NOT NULL`. Questo rende il contatore resiliente a prescindere dal path di acquisizione.

### Raccomandazione

Preferisco l'**opzione 1** (fix dati + segnaposto) perche' mantiene la semantica semplice di `get_country_stats()`. L'opzione 2 rischia di mascherare partner che davvero non hanno dati.

### Dettaglio Tecnico

```sql
-- Fix: marca come "con profilo" i partner che hanno dati reali
UPDATE partners
SET raw_profile_html = '<imported-without-html>'
WHERE raw_profile_html IS NULL
  AND (
    EXISTS (SELECT 1 FROM partner_contacts pc WHERE pc.partner_id = partners.id)
    OR enrichment_data->>'deep_search_at' IS NOT NULL
  );
```

Questo correggerebbe immediatamente i 184 partner (inclusi i 178 della Thailandia).

