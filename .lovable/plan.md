## Obiettivo

Tre interventi mirati su Finder API, senza toccare logica di submit/AI/edge critiche oltre lo stretto necessario.

---

### 1. Fix warning "Function components cannot be given refs"

**File:** `src/components/ui/badge.tsx`

Convertire `Badge` in `React.forwardRef<HTMLDivElement, BadgeProps>`. Modifica isolata, retro-compatibile (nessuna prop cambia).

```text
- function Badge({...}) { return <div .../> }
+ const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({...}, ref) =>
+   <div ref={ref} ... />)
+ Badge.displayName = "Badge"
```

Nessuna modifica nei call-site (incluso `FinderApiCatalogTab.tsx`).

---

### 2. Pulsante "indietro" in alto a sinistra su Finder API e Schema

**Stato attuale:**
- `FinderApiPage.tsx` già monta `CommandPageBackButton` → ✅ ok, ma verifichiamo che sia visibile.
- `FinderApiSchemaMapPage.tsx` non ha alcun back button.

**Azione:**
- Aggiungere in cima a `FinderApiSchemaMapPage.tsx` un pulsante (icona `ArrowLeft` da lucide) ancorato top-left che chiama `navigate(-1)` (fallback `/v2`). Stile coerente con `CommandPageBackButton` ma standalone (la pagina non usa il background Command).
- Verificare che su `FinderApiPage` il `CommandPageBackButton` non sia coperto dall'header → in caso, aumentare z-index.

> Nota: "Finder" come pagina separata non esiste; esistono solo `/v2/finder-api` e `/v2/finder-api/schema`. Interpreto la richiesta come "entrambe le pagine Finder API".

---

### 3. Sfruttare appieno la schema map nell'agente (`finder-api-chat`)

**Stato attuale:** `loadSchemaMap` carica già **tutti** i 1.360 campi e li inietta nel system prompt come testo flat. Problemi:

- 1.360 righe = ~50-80k token → satura contesto e costo.
- L'agente non sa **che la mappa esiste come strumento**: la legge come "muro di testo".
- Nessun filtro per op chiamata.

**Refactor minimo (file `supabase/functions/finder-api-chat/index.ts`):**

a) **Sommario invece di dump**: nel system prompt iniettare solo il **manifest**: `op → numero campi → ruoli presenti` (1 riga per op, ~185 righe). L'agente sa cosa c'è.

   ```
   === SCHEMA MAP TMWE (manifest) ===
   shipment.list: 12 campi [id_interno×3, data×4, stato×2, contatto×3]
   tracking.byAwb: 8 campi [tracking_code×2, data×3, stato×3]
   ...
   ```

b) **Tool nuovo `schema_lookup(op)`**: aggiungere a `buildTools` un tool che restituisce i campi di una singola op. L'agente lo invoca **prima** di `tmwe_call` quando deve mappare una risposta.

c) **Iniezione automatica post-tmwe_call**: dopo ogni esecuzione `tmwe_call(op, …)`, se la mappa contiene quell'op, allegare i campi corrispondenti come "hint" nel turno successivo (già abbiamo i dati in memoria).

**Vantaggi della mappa per le query future** (da spiegare all'utente in chat di risposta, non nel codice):

| Senza mappa | Con mappa |
|---|---|
| L'agente "indovina" dove sta l'AWB nel JSON | Sa che `data.shipments[].awb_code = tracking_code` |
| Risposte testuali generiche | Estrae il valore esatto e formatta tabelle/card |
| Errori di field non trovato | Validation pre-call dei filtri |
| Impossibile fare cross-op (es. AWB di una shipment → tracking) | Joint reasoning su campi con stesso `role` |
| 200+ token per "esplorare" il payload ad ogni chiamata | 0 token (mappa pre-caricata) |
| Latenza: spesso 2 chiamate (lista + dettaglio) | 1 chiamata + estrazione locale |

---

### 4. Abilitare endpoint admin GET/POST/PUT (mantenere DELETE off per sicurezza)

**Stato DB attuale** (`tmwe_api_catalog`):

```text
GET  read         enabled  78
GET  admin        OFF      28   ← abilitare
POST read         enabled   3
POST write        enabled  76
POST admin        OFF      49   ← abilitare
PUT  write        enabled   3
PUT  admin        OFF       3   ← abilitare
PATCH write       enabled   2
DELETE destructive OFF     22   ← lasciare off (safety)
DELETE admin      OFF      15   ← lasciare off (safety)
```

**Migration:**

```sql
UPDATE tmwe_api_catalog
SET enabled = true
WHERE enabled = false
  AND method IN ('GET','POST','PUT','PATCH')
  AND risk_level = 'admin';
```

Effetto: +80 endpoint disponibili all'agente (tot 245 abilitati su 279). DELETE restano off — possono essere abilitati on-demand dal toggle UI quando serve davvero (hard guard di sicurezza richiesto dal Charter AI). Lo dichiaro all'utente nel messaggio finale.

---

### File toccati

```text
src/components/ui/badge.tsx                                   (forwardRef)
src/v2/ui/pages/finder-api/FinderApiSchemaMapPage.tsx         (back button)
src/v2/ui/pages/FinderApiPage.tsx                             (z-index back button se serve)
supabase/functions/finder-api-chat/index.ts                   (manifest + schema_lookup tool + post-call hint)
+ migration: UPDATE tmwe_api_catalog ... admin GET/POST/PUT
```

### Fuori scope
- DELETE admin/destructive: lasciati off per safety. Se vuoi anche quelli, dimmelo e aggiungo alla migration.
- Non tocco `tmwe-catalog-sync`, `check-inbox`, `email-imap-proxy` (protetti).
- Nessun refactor opportunistico su `loadEnabledOps` o `buildTools` oltre l'aggiunta del tool.
