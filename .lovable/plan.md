

# Fix: Usare la cache della directory invece di riscansionare

## Problema

Quando nella pagina Acquisizione selezioni "tutti i network", il codice attuale cicla su **tutti e 9 i network individualmente** (WCA Inter Global, WCA China Global, ecc.), cercando una entry di cache separata per ognuno. Ma la cache nel database e' salvata con `network_name = ""` quando si scansionano tutti i network insieme (cosi' fa il Download Management).

Risultato: le due pagine non condividono mai la cache, e l'Acquisizione fa 9 chiamate separate al posto di una sola.

Per la Svizzera, ad esempio, esiste in cache solo `network_name = "WCA Time Critical"` (7 risultati). Mancano tutte le altre entry perche' la scansione "tutti" nel Download Management salva con `network_name = ""`, e l'Acquisizione non cerca mai con quella chiave.

## Soluzione

### File: `src/pages/AcquisizionePartner.tsx`

Allineare la logica di scansione a quella del ActionPanel:

- **Se nessun network selezionato**: cercare nella cache con `network_name = ""` (= tutti). Se non c'e', chiamare la scansione con `networkName: ""` (che restituisce tutti i partner del paese). Salvare il risultato con `network_name = ""`.

- **Se un network specifico selezionato**: cercare nella cache con quel network specifico. Se non c'e', scansionare solo quel network.

- **Non iterare mai su tutti e 9 i network individualmente.**

Cambio principale alla funzione `handleScan` (righe 161-219):

```typescript
// PRIMA (bug): itera su 9 network separati
const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [...WCA_NETWORKS];
for (const net of networkFilter) { ... }

// DOPO (fix): usa "" per "tutti", come fa ActionPanel
const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [""];
for (const net of networkFilter) {
  // Cache lookup con la chiave corretta
  let query = supabase.from("directory_cache").select("*").eq("country_code", code);
  if (net) query = query.eq("network_name", net);
  else query = query.eq("network_name", "");
  // ...
}
```

Inoltre, quando si chiama `scrape-wca-directory` e non c'e' cache, passare `networkName: net` (che sara' `""` per "tutti").

### File: nessun altro file da modificare

La cache del ActionPanel usa gia' `network_name = ""` per "tutti i network", quindi dopo questa fix le due pagine condivideranno la stessa cache.

## Risultato

- Zero scansioni duplicate: se il Download Management ha gia' scansionato un paese, l'Acquisizione usa quei dati
- Una sola query al posto di 9 quando si seleziona "tutti i network"
- La Svizzera mostrera' tutti i partner (non solo 7 di un singolo network)

