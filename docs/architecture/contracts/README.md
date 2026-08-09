# Contratti di integrazione (bozza, nessuna implementazione)

Documento preparatorio. Nessun codice implementa ancora questi contratti.

## 1. Job API (Cobra)

```http
POST /jobs
{ "type": "enrichment.batch", "payload": { ... }, "idempotency_key": "..." }
-> 202 { "job_id": "..." }

GET /jobs/{job_id}
-> { "job_id", "status": "queued|running|succeeded|failed|cancelled",
     "steps": [...], "result": { ... }, "error": null }
```

Al completamento Cobra invoca un webhook registrato dal chiamante con lo stesso envelope evento.

## 2. Event envelope comune

```json
{
  "event_id": "uuid",
  "type": "partner.enriched",
  "occurred_at": "2026-08-09T12:00:00Z",
  "source": "research-engine",
  "subject_id": "partner:uuid",
  "version": 1,
  "payload": {}
}
```

## 3. Outbox lato Navigator

Gli eventi si scrivono in una tabella outbox nella stessa transazione della modifica dati; un
worker separato li pubblica. Nessuna chiamata cross-service dentro un flusso UI.

## 4. Idempotenza

Ogni consumer deve essere idempotente su `idempotency_key` / `event_id`: dedup, invio email ed
enrichment non devono mai produrre side-effect doppi.

## 5. Service contract card (per ogni servizio)

- Dati posseduti
- API pubblica
- Eventi emessi / consumati
- SLO e limiti (rate, timeout, retry)
- Owner