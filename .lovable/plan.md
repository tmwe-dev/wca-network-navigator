

## Analisi completa: Loghi nel Partner Hub

### Stato attuale del codice

Il codice in `PartnerCard.tsx` (righe 81-97) **e gia corretto**. La logica a 3 livelli funziona:

1. `partner.logo_url` → logo branding (priorita)
2. Google Favicon → fallback se no logo_url
3. Bandiera paese → fallback finale

La query in `usePartners.ts` usa `select(*)` che include `logo_url`. Nessun bug nel rendering.

### Stato dei dati nel database

| Metrica | Conteggio |
|---|---|
| Partner totali | 1554 |
| Con logo_url | 574 (37%) |
| — di cui logo reali (branding) | 309 |
| — di cui Google favicon salvati | 265 |
| **Senza logo_url** | **980 (63%)** |

### Il vero problema

Il 63% dei partner non ha un `logo_url` perche **non hanno ancora avuto una Deep Search**. Per quei partner:
- Se hanno un sito web → mostrano il favicon di Google (iconcina piccola)
- Se non hanno sito web → mostrano la bandiera del paese

I loghi branding vengono salvati dalla Deep Search (riga 553-596 della edge function). **Senza eseguire la Deep Search su un partner, il logo branding non esiste nel database.**

I 265 logo salvati come "Google favicon" sono il risultato del fallback a riga 586-591 della edge function: quando il sito non ha un branding logo ne un OG image, salva il favicon come ultima risorsa.

### Cosa non va

Niente e rotto — il sistema funziona come progettato. Per vedere loghi branding, serve eseguire la Deep Search sui partner. Quelli gia processati (574) mostrano il loro logo. Quelli non processati (980) mostrano favicon o bandiera.

### Nessuna modifica necessaria

Il codice e gia corretto. Non servono modifiche al frontend ne al backend.

