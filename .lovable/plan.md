

# Download a Due Fasi con Velocita Separate

## Problema Attuale
Il sistema salta la fase di lettura della directory WCA e va direttamente a scansionare ID alla cieca. L'utente vuole vedere due operazioni distinte, ciascuna con i propri controlli di velocita:
1. **Fase 1 - Lettura Lista**: leggere la pagina directory WCA pagina per pagina, vedere i nomi apparire riga per riga
2. **Fase 2 - Download Profili**: scaricare i dettagli uno per uno dagli ID raccolti

## Soluzione

### Nuovo flusso del wizard (4 step invece di 3)

```text
Paesi --> Network --> FASE 1: Scansione Lista --> FASE 2: Download Profili
                      (pagina per pagina,          (profilo per profilo,
                       velocita configurabile)       velocita configurabile)
```

### Fase 1 - Scansione Directory (nuovo step "listing")

- Dopo la selezione di paese e network, parte la scansione della directory WCA
- Usa la edge function `scrape-wca-directory` gia esistente, ma con l'URL corretto: `https://www.wcaworld.com/Directory?siteID=24&country=AL&pageIndex=1&pageSize=50&networkIds=...`
- **Controllo velocita dedicato**: slider per decidere il ritardo tra una pagina e l'altra (es. 5s, 10s, 30s)
- **Visualizzazione live**: ogni partner trovato appare riga per riga nella lista, con contatore "Pagina 1/N - Trovati: 12"
- Al termine si mostra il riepilogo: "Trovati 47 partner in 3 pagine per Albania"
- Pulsante "Avvia Download Dettagli" per passare alla Fase 2

### Fase 2 - Download Profili (step "running" esistente, migliorato)

- Riceve la lista di WCA ID dalla Fase 1 (non piu range cieco)
- **Controllo velocita dedicato separato**: slider identico ma indipendente, con i suoi parametri di pausa
- Funzionamento identico a quello attuale ma con gli ID precisi raccolti dalla directory

### Modifiche alla Edge Function `scrape-wca-directory`

Aggiornare l'URL per usare il formato corretto fornito dall'utente:
- URL base: `https://www.wcaworld.com/Directory`
- Parametri: `siteID=24`, `pageIndex`, `pageSize=50`, `searchby=CountryCode`, `country=AL`, `networkIds=1,2,3...`, `orderby=CountryCity`, `layout=v1`, `submitted=search`
- Mapping dei network names ai networkIds numerici

### Dettagli Tecnici

**File da modificare:**

1. **`supabase/functions/scrape-wca-directory/index.ts`**
   - Aggiornare URL da `/MemberDirectory` a `/Directory` con i parametri corretti (`siteID=24`, `pageSize=50`, `pageIndex`, `searchby=CountryCode`, `networkIds`)
   - Aggiungere mapping network name -> networkId numerico
   - Migliorare il prompt di estrazione per il nuovo formato pagina

2. **`src/lib/api/wcaScraper.ts`**
   - Aggiornare parametri di `scrapeWcaDirectory` per accettare `countryCode` (es. "AL") invece di country name, e `pageIndex`

3. **`src/pages/DownloadManagement.tsx`**
   - Aggiungere sub-step `"listing"` al wizard tra `"network"` e `"speed"`
   - Nuovo componente `DirectoryScanner`:
     - Slider velocita per la scansione lista (ritardo tra pagine)
     - Tabella live che si popola riga per riga con i partner trovati
     - Contatore pagine: "Pagina 2/5 - Letta in 3.2s"
     - Contatore partner: numero che sale in tempo reale
     - Pulsanti Pausa/Riprendi/Stop
     - Al completamento: riepilogo + pulsante "Scarica Dettagli"
   - Modificare `ScanConfig` per ricevere la lista ID dalla Fase 1 invece di calcolare range
   - Aggiungere label "Velocita Fase 2" per distinguere i due slider
   - Il `DownloadRunning` riceve `config.ids` (array preciso) invece di `config.mode === "range"`

**Step del wizard aggiornati:**
```text
Paesi --> Network --> Scansione Lista --> Configura & Scarica
  (1)       (2)           (3)                  (4)
```

Il passo 3 e la parte dinamica dove l'utente vede i partner apparire. Il passo 4 configura la velocita del download dettagliato e avvia.

