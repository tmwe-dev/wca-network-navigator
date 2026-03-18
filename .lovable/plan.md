

## Country Workbench — Service filters senza numeri, dropdown Network e Branch Countries

### Modifiche

#### 1. Service filters: rimuovere numeri, solo icone
- Togliere `<span>{count}</span>` da ogni chip servizio — mostrare solo l'icona
- Il conteggio appare nel tooltip on hover (es. "Air Freight (3)")
- Ridurre gap tra icone (`gap-0.5`) per renderle compatte
- Mantenere AND logic: selezionando air + ocean, il partner deve averli entrambi

#### 2. Card: sostituire network con branch flags
- **Rimuovere** la riga dei network names dalle card
- **Aggiungere** a destra, sotto il trofeo anni, il numero dei network (es. icona `Users` + "3") come dato compatto
- **Aggiungere** in basso (dopo i servizi) una riga con le bandiere emoji dei paesi in cui il partner ha filiali, usando `getBranchCountries()` da `partnerUtils.ts` e `getCountryFlag()`

#### 3. Dropdown Network filter (nuovo)
- Aggiungere un `Select` dropdown nella toolbar (dopo i sort icons e i generic filters)
- Opzioni: tutti i network presenti nel paese (raccolti dinamicamente da `partner_networks`)
- Valore default: "Tutti" (nessun filtro)
- Quando selezionato, filtra i partner che appartengono a quel network

#### 4. Dropdown Branch Country filter (nuovo)
- Aggiungere un secondo `Select` dropdown nella toolbar
- Opzioni: tutti i paesi in cui almeno un partner del paese corrente ha una filiale (raccolti da `branch_cities`)
- Valore default: "Tutti" (nessun filtro)
- Quando selezionato, mostra solo i partner che hanno una filiale nel paese scelto
- Usare `getBranchCountries()` + flag emoji nelle opzioni

#### 5. Layout toolbar aggiornato
```text
┌──────────────────────────────────────────────┐
│ 🔍 Cerca partner...                         │
├──────────────────────────────────────────────┤
│ [👤][📍][⭐][🏆] │ 🔍 ⭐ │ ✈🚢📦🚛🚂⚠ [✕]│
├──────────────────────────────────────────────┤
│ Network: [▾ Tutti]   Filiali: [▾ Tutti]     │
├──────────────────────────────────────────────┤
│ 2 partner                      Sel. tutti   │
└──────────────────────────────────────────────┘
```

#### File coinvolto
- `src/components/partners/CountryWorkbench.tsx` — unico file

#### Nuovi stati
- `networkFilter: string | null` — network_name selezionato o null
- `branchCountryFilter: string | null` — country_code filiale selezionato o null

#### Logica filtro aggiornata
```typescript
// Nella catena filteredPartners:
if (networkFilter) list = list.filter(p => 
  (p.partner_networks || []).some(n => n.network_name === networkFilter));
if (branchCountryFilter) list = list.filter(p => 
  getBranchCountries(p).some(b => b.code === branchCountryFilter));
```

