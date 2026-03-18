

## Fix Network Filter Dropdown

### Problemi
1. Il dropdown network include valori spazzatura dal database (es. "linkedin.com") che non sono network WCA
2. Il dropdown potrebbe non funzionare correttamente nella selezione

### Soluzione

**File: `src/components/partners/CountryWorkbench.tsx`**

1. **Importare la lista canonica dei network WCA** dal file `PartnerFiltersSheet.tsx` (o usare la stessa lista inline). I network validi sono:
   - WCA Inter Global, WCA First, WCA Advanced Professionals, WCA China Global, WCA Projects, WCA Dangerous Goods, WCA Perishables, WCA Time Critical, WCA Pharma, WCA eCommerce, WCA eCommerce Solutions, WCA Relocations, WCA Live Events & Expo, Global Affinity Alliance, Lognet Global, Infinite Connection, Elite Global Logistics Network

2. **Filtrare `availableNetworks`** (righe 156-162): nel memo, dopo aver raccolto i nomi dal database, intersecare con la lista canonica WCA. Solo i network che appaiono sia nei dati che nella lista canonica vengono mostrati nel dropdown.

```typescript
const VALID_NETWORKS = new Set([
  "WCA Inter Global", "WCA First", "WCA Advanced Professionals", 
  "WCA China Global", "WCA Projects", "WCA Dangerous Goods", 
  "WCA Perishables", "WCA Time Critical", "WCA Pharma", 
  "WCA eCommerce", "WCA eCommerce Solutions", "WCA Relocations",
  "WCA Live Events & Expo", "Global Affinity Alliance", 
  "Lognet Global", "Infinite Connection", 
  "Elite Global Logistics Network",
]);

const availableNetworks = useMemo(() => {
  const names = new Set<string>();
  countryPartners.forEach((p) => {
    (p.partner_networks || []).forEach((n: any) => {
      if (VALID_NETWORKS.has(n.network_name)) names.add(n.network_name);
    });
  });
  return Array.from(names).sort();
}, [countryPartners]);
```

Nessun altro file da modificare.

