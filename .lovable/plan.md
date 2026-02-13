

## Fix: CountryGrid Non Mostra Email/Telefoni

### Causa del Bug

Il hook `useContactCompleteness()` restituisce un oggetto con questa struttura:

```text
{
  global: { total, withEmail, withPhone, ... },
  byCountry: { "AL": { total_partners: 10, with_personal_email: 9, ... }, ... }
}
```

Ma nella CountryGrid (riga 69), il codice accede cosi':

```text
const { data: completeness } = useContactCompleteness();
// ...
const cs = completeness?.[c.code];  // <-- BUG: cerca completeness["AL"] che non esiste
```

Dovrebbe essere `completeness?.byCountry?.[c.code]`. Senza `.byCountry`, cerca la chiave "AL" al primo livello dell'oggetto (dove ci sono solo `global` e `byCountry`), quindi restituisce sempre `undefined` e i contatori mostrano zero.

### Fix

**File: `src/components/download/CountryGrid.tsx`** (riga ~167)

Cambiare:
```
const cs = completeness?.[c.code];
```
in:
```
const cs = completeness?.byCountry?.[c.code];
```

Una sola riga. Tutti i contatori email/telefono si popoleranno immediatamente.

