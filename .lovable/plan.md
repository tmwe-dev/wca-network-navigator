

## Diagnosi del problema

Dai log dell'edge function il quadro è chiaro:

```
column_mapping keys: []     ← VUOTO
confidence: 0.9             ← ALTA
unmapped: [36 colonne metadata]
```

L'AI restituisce confidence 0.9 ma `column_mapping` è vuoto. Le colonne contatto (name, email, phone, city ecc.) non compaiono né nel mapping né nell'unmapped — significa che l'AI le riconosce e le usa per generare `parsed_rows`, ma **non popola `column_mapping`**.

**Causa tecnica**: lo schema del tool definisce `column_mapping` come `{ additionalProperties: { type: "string" } }` (oggetto con chiavi dinamiche). Gemini Flash ha difficoltà con questo pattern e restituisce `{}` anziché le coppie chiave-valore.

Il frontend poi blocca tutto perché `mappingKeys.length === 0`.

## Piano di fix

### 1. Edge function: derivare il mapping server-side se l'AI lo lascia vuoto

Dopo aver ricevuto la risposta AI, se `column_mapping` è vuoto MA `parsed_rows` ha dati, **ricostruire il mapping** confrontando le chiavi sorgente (dal campione inviato) con i valori nelle parsed_rows. Logica:

- Per ogni campo target che ha un valore in parsed_rows, cercare quale chiave sorgente contiene quel valore esatto
- Costruire il mapping `source_key → target_field`

Questo è un fallback meccanico, non handcode: non ci sono regole "name_2 = company_name", ma un confronto valore-per-valore.

### 2. Cambiare lo schema del tool: array invece di oggetto dinamico

Sostituire `column_mapping` da oggetto con chiavi dinamiche ad array di coppie esplicite:

```json
"column_mapping": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "source": { "type": "string" },
      "target": { "type": "string" }
    },
    "required": ["source", "target"]
  }
}
```

I modelli AI gestiscono molto meglio array di oggetti tipizzati rispetto a oggetti con chiavi arbitrarie. Dopo la risposta, l'edge function converte l'array in un dizionario prima di restituirlo al frontend.

### 3. Frontend: nessuna modifica alla logica

Il frontend continua a ricevere `column_mapping` come dizionario `{ source: target }` — la conversione avviene server-side. Nessun fallback `parsed_rows` nel frontend.

### File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/analyze-import-structure/index.ts` | Schema tool: array di coppie; fallback server-side da parsed_rows; conversione array→dizionario |

