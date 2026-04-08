# ADR 0002 — ApiError standardizzato per gli errori API

**Stato**: accepted
**Data**: 2026-04-08
**Riferimento**: Vol. II §4.4 (Gestione errori), §5.3 (Errori API)

## Contesto

Prima di questa decisione, ogni modulo API gestiva gli errori in modo
diverso:

```ts
if (!res.ok) throw new Error(`Discover failed: ${res.status}`);
// oppure
if (!res.ok) throw new Error(`Scrape failed: ${res.status}`);
// oppure
const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
throw new Error(err.error || `HTTP ${res.status}`);
```

I chiamanti dovevano fare regex su `err.message` per capire se si
trattava di 401, 429 o errore di rete. Vol. II §5.3 vieta esplicitamente
questo pattern: *"Il client non deve mai dover analizzare stringhe per
capire cosa sia successo: deve poter agire in base al codice di errore."*

Vol. II §4.4 categorizza ogni errore in tre classi (errore utente,
errore sistema, errore imprevisto) ma senza un tipo concreto questa
categorizzazione resta solo descrittiva.

## Decisione

Introduciamo `ApiError` (`src/lib/api/apiError.ts`) come **unica classe
di errore** lanciata dai moduli API. La classe espone:

- `code: ApiErrorCode` — discriminator applicativo enumerato
  (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`,
  `RATE_LIMITED`, `SERVER_ERROR`, `NETWORK_ERROR`, `SCHEMA_MISMATCH`,
  `UNKNOWN_ERROR`).
- `message: string` — leggibile dall'utente finale.
- `httpStatus?: number` — quando applicabile.
- `details?: Record<string, unknown>` — payload strutturato dal server.
- `toJSON()` — serializzabile per il logger strutturato.

Due fabbriche statiche normalizzano gli ingressi:

- `ApiError.fromResponse(res, context)` — mappa `res.status` su
  `ApiErrorCode` e tenta di estrarre `error`/`message` dal body JSON.
- `ApiError.from(err, context)` — converte qualunque errore generico in
  `ApiError`, classificando `TypeError` e errori con `"fetch"` nel
  messaggio come `NETWORK_ERROR`.

Tutti i moduli API esistenti (`wcaAppApi.ts`, `checkInbox.ts`) sono
stati migrati per lanciare `ApiError`. Il helper privato `assertOk` di
`wcaAppApi.ts` centralizza la conversione `Response → ApiError`.

## Conseguenze

**Positive**

- I chiamanti possono fare `if (isApiError(err) && err.code === "RATE_LIMITED")`
  senza parsing di stringhe.
- I log strutturati ricevono `code` come campo indicizzabile, abilitando
  dashboard di error tracking per categoria (Vol. II §12.2).
- Aggiungere un nuovo `ApiErrorCode` è una sola modifica enum + un
  branch nel mapping `fromResponse`; nessun altro modulo cambia.
- L'`ErrorBoundary` globale può mostrare messaggi diversi in base al
  `code`, migliorando la **stabilità percepita** (Vol. II §14.1).

**Negative**

- Tutti i moduli API esistenti devono migrare a `ApiError`; per evitare
  un big-bang refactor, i moduli legacy convivono finché non vengono
  toccati.
- I test unitari devono distinguere tra `Error` generico e `ApiError`.

## Alternative scartate

- **Result type (`{ ok: true, value } | { ok: false, error }`)**:
  forza una rivisitazione di ogni call-site (no zero-cost). Rinviato.
- **Eccezioni native con `cause`**: standard ES2022 ma manca il
  discriminator esplicito; richiede comunque un wrapper.
- **HTTP status come unico contratto**: insufficiente per
  `SCHEMA_MISMATCH` e `NETWORK_ERROR` che non hanno status code.

## Stato di adozione

| Modulo | Migrato a ApiError |
|---|---|
| `src/lib/api/wcaAppApi.ts` | ✅ (14 endpoint via `assertOk`) |
| `src/lib/checkInbox.ts` | ✅ |
| `src/lib/api/wcaScraper.ts` | facade — indiretto |
