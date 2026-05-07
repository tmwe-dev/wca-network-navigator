# Click-to-filter su città, paese e gruppo — parità con BCA

Obiettivo: rendere coerente il comportamento dei filtri tra BCA (biglietti da visita) e le maschere Network/CRM/Partner. Cliccando bandiera/città dentro le card si applica il filtro corrispondente.

## A. Estendere `CompanyFiltersState`

In `src/v2/ui/molecules/CompanyCardList/filters.ts` (o equivalente):
- Aggiungere campi opzionali `country?: string | null` e `city?: string | null` (lowercase normalizzato).
- Estendere `applyCompanyFilters()` con confronto case-insensitive su `company.country_code` / `company.city`.
- Aggiungere chip rimovibili in `ActiveFiltersBar`.

Nessuna rimozione di filtri esistenti. Tutto retro-compatibile.

## B. Atom `EntityRow` — callback opzionali

In `src/v2/ui/atoms/EntityRow.tsx`:
- Nuovi prop opzionali: `onCountryClick?: (code: string) => void`, `onCityClick?: (city: string) => void`.
- Quando presenti: bandiera (col 2) e città (col 4) diventano `<button>` con `stopPropagation`, hover sottile, `aria-label`.
- Quando assenti: comportamento attuale invariato.

## C. Propagazione in WCA Network e CRM Contacts

In `EntityListWithDetail` (usato da `NetworkPage` e `ContactsPage`):
- Wire dei callback verso `CompanyCardList` → `CompanyCard` → `EntityRow`.
- I callback aggiornano `filters.country` / `filters.city` (toggle: re-click rimuove).
- Sync con `GlobalFiltersContext.networkSelectedCountries` / `crmSelectedCountries` quando si clicca la bandiera (così resta coerente con `CountryGridV2`).

## D. BCA — click bandiera nelle card

In `BcaCompactCard`, `BcaGridCard`, `BcaExpandedCard`:
- Aggiungere `onClick` esplicito sull'elemento bandiera che chiama `g.setSelectedCountry(code)` (con toggle: se già selezionato → `null`).
- `stopPropagation` per non innescare apertura modale.

Nessuna modifica a `useBcaGrouping` o alla sidebar.

## Vincoli

- UI-only: nessuna modifica a hook dati, DAL, edge functions, RLS.
- Nessun refactor opportunistico. Prop nuove tutte opzionali.
- Niente nuovi colori hardcoded: usare token semantici esistenti.
- Nessuna modifica a nodi critici (submit, AI, batch, dedup, invio messaggi).

## Dettagli tecnici

File toccati (stimati 5–7):
- `src/v2/ui/molecules/CompanyCardList/filters.ts` (+ `applyCompanyFilters`)
- `src/v2/ui/molecules/CompanyCardList/ActiveFiltersBar.tsx`
- `src/v2/ui/atoms/EntityRow.tsx`
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx`
- `src/v2/ui/organisms/EntityListWithDetail.tsx`
- `src/v2/ui/molecules/bca/BcaCompactCard.tsx`, `BcaGridCard.tsx`, `BcaExpandedCard.tsx`

## QA

- Click bandiera in WCA Network → filtra paese; chip visibile; re-click rimuove.
- Click città in CRM → filtra città; chip visibile.
- Click bandiera in BCA → sidebar si aggiorna sul paese.
- Card senza callback (es. usi legacy di `EntityRow`) → invariate.
