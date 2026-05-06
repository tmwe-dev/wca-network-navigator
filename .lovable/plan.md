## Diagnosi

I tracking falliscono **non per colpa dell'agente**, ma per due bug infrastrutturali:

### Bug #1 — 273 endpoint del catalogo hanno path sbagliato (404 Apache)

```text
Solo 6 op (le hard-coded originali) hanno path con prefisso /erp/...
Le altre 273 sincronizzate dalla doc TMWE hanno path /tmwe_json/...
```

→ `callTmwe()` fa `https://sandbox.findair.net/tmwe_json/ext_tracking` ma TMWE risponde solo su `https://sandbox.findair.net/erp/tmwe_json/ext_tracking`. Da qui il **404 HTML Apache** che hai visto su `tracking.ext_tracking` e `courier.tracking_aggregator`.

**Fix:** una riga in `supabase/functions/_shared/tmweClient.ts → callTmwe()`:

```ts
let path = op.path;
if (path.startsWith("/tmwe_json/")) path = "/erp" + path; // normalizza
let url = `${baseUrl()}${path}`;
```

Sistema **tutti i 273 endpoint** in un colpo, senza toccare il sync né la tabella.

### Bug #2 — `tracking.byAwb` risponde 400

L'agente ha mandato `{awb: "9352100542"}`. L'endpoint `/erp/tmwe_json/shipment_tracking` non accetta l'AWB pubblico ma il `shipment_id` interno TMWE. La SCHEMA MAP per quell'op è già curata (`rubrica.search`, `shipment.list`, `shipment.unified` ecc.), ma manca un'indicazione esplicita su `tracking.byAwb` parametri.

**Fix doppio:**

a) **Schema map**: aggiungere voci canoniche per `tracking.byAwb` con `shipment_id [id_interno]` come param obbligatorio + esempio. Così `schema_lookup(tracking.byAwb)` glielo dirà.

b) **Prompt agente**: regola esplicita "se hai solo un AWB (numero pubblico), prima cerca la spedizione: chiama `shipment.list` (o `shipment_management.ext_my_shipments`) filtrando per quel numero, estrai `shipment_id` dalla risposta, poi `tracking.byAwb({shipment_id})`." Niente più resa al primo 400.

### Bug #3 — Agente si arrende troppo presto

Anche con i fix sopra, va rinforzato:
- regola "su 400/404 prova SEMPRE prima a cercare l'oggetto via `shipment.list`/`ext_my_shipments` filtrando per il numero, poi richiama il tracking col vero ID interno"
- regola "non chiedere mai il corriere se hai un AWB: l'aggregator (quando funziona) lo deduce, altrimenti il tracking interno TMWE non ne ha bisogno"

### Bonus — Warning console residuo

`Function components cannot be given refs. Check the render method of EmailPreviewDialog.` Cosmetico, fuori dallo scope di questa richiesta. Lo lasciamo o lo includo? (Default: lascio fuori.)

---

## File toccati

```text
supabase/functions/_shared/tmweClient.ts      → fix path /erp prefix in callTmwe (1 riga)
supabase/functions/finder-api-chat/index.ts   → prompt: workflow AWB→shipment_id→tracking
+ insert dati: finder_api_schema_map per tracking.byAwb (shipment_id, awb opzionale, ecc.)
```

Nessun cambio schema DB. Nessun toccare di sync, edge protette, RLS.

## Verifica

Dopo deploy: chiediamo ancora `9352100542 dammi il tracking`. Atteso: agente chiama `shipment.list` filtrando AWB → ottiene shipment_id → `tracking.byAwb({shipment_id})` → restituisce stato + eventi. Se ancora 0 risultati, allora la spedizione realmente non è dell'utente connesso e l'agente lo dice spiegando "nessuna spedizione tua con AWB X".
