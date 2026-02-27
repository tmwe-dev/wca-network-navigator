

## Piano: Ripristino selezione multi-paese

### Modifiche in `src/pages/Operations.tsx`

1. Sostituire `activeCountry: { code, name } | null` con `selectedCountries: { code: string; name: string }[]`
2. `handleCountryClick` → toggle nel/dall'array (aggiunge se non presente, rimuove se presente)
3. Derivare `activeCountryCodes = selectedCountries.map(c => c.code)`
4. Pannello destro visibile quando `selectedCountries.length > 0` (non solo single)
5. `CountryGrid.selected` → `selectedCountries` direttamente
6. `CountryGrid.onRemove` → accetta `code: string` e rimuove solo quel paese dall'array
7. `PartnerListPanel` riceve `countryCodes` e `countryNames` (array) invece di singoli
8. Passare tutti i codici selezionati a `handleGenerateAliases`
9. `AiAssistantDialog` context usa `selectedCountries` direttamente
10. Grid a sinistra si restringe a 260px quando `selectedCountries.length > 0`

### Modifiche in `src/components/operations/PartnerListPanel.tsx`

1. Props: `countryCode: string` → `countryCodes: string[]`, `countryName: string` → `countryNames: string[]`
2. Rimuovere il `useMemo` che wrappa `countryCode` in array (linea 60) — usare `countryCodes` direttamente
3. Header: mostrare le flag di tutti i paesi selezionati + "N paesi" quando >1
4. Il reset su cambio paese (useEffect linea ~184) deve dipendere da `countryCodes`
5. Scan directory: iterare su tutti i `countryCodes`

### Modifiche in `src/components/download/CountryGrid.tsx`

1. `onRemove` prop: cambiare tipo da `(code: string) => void` (già accetta string nella firma ma Operations passa `() => void`)
2. Nessun'altra modifica necessaria — supporta già multi-select

### File

| File | Modifica |
|------|----------|
| `src/pages/Operations.tsx` | `activeCountry` → `selectedCountries[]`, multi-toggle |
| `src/components/operations/PartnerListPanel.tsx` | Props multi-country, header multi-flag |
| `src/components/download/CountryGrid.tsx` | Verifica `onRemove(code)` coerente |

