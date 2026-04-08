# ADR 0003 — Logger strutturato createLogger come unico punto di logging

**Stato**: accepted
**Data**: 2026-04-08
**Riferimento**: Vol. II §4.5 (Logging e osservabilità), §12.1 (Log centralizzati)

## Contesto

Vol. II §4.5 prescrive: *"Ogni operazione significativa del sistema deve
produrre un record nel log. Il log deve essere strutturato, correlabile,
e inviato a un sistema centralizzato."*

Prima di questa decisione il codebase usava `console.log/warn/error`
sparso in dozzine di file, con messaggi testuali non ricercabili e
nessun arricchimento di contesto (utente, sessione, route). I log
prodotti erano inutilizzabili per il debug post-incident.

## Decisione

Introduciamo `src/lib/log.ts` come **unico punto di logging**
dell'applicazione. L'API è:

```ts
import { createLogger } from "@/lib/log";
const log = createLogger("MyModule");
log.info("operazione completata", { jobId });
log.error("download fallito", { reason: err.message });
```

Caratteristiche:

1. **Record strutturato**: ogni `log.*` produce un `LogRecord` con
   `timestamp`, `level`, `module`, `message`, `context`, `userId`,
   `sessionId`, `route`, `userAgent`. Il `userId` è recuperato in modo
   safe dalla session Supabase in localStorage; il `sessionId` è
   generato/persistito in `sessionStorage`.
2. **Sink pluggabili**: il default è `consoleSink`. Sink remoti
   (Sentry, Logtail, Datadog) possono essere registrati con
   `logConfig.addSink(fn)` senza modifiche ai call-site.
3. **Filtro per livello**: `logConfig.setMinLevel("warn")` per silenziare
   debug/info in produzione.
4. **Resilienza**: se un sink lancia, l'errore è ingoiato — un sink
   rotto non deve mai far cadere l'applicazione.

**Regola d'oro**: nessun `console.*` direttamente nell'app. Solo
`src/lib/log.ts` è autorizzato a chiamare `console`, e lo fa in
`consoleSink`.

## Conseguenze

**Positive**

- Tutti i log ora sono ricercabili per `module`, `userId`, `sessionId`,
  `route` (Vol. II §12.1).
- L'integrazione di un sink remoto è una sola riga, senza toccare
  i moduli applicativi (zero-touch su 80+ call-site).
- La `GlobalErrorBoundary` (`src/components/system/GlobalErrorBoundary.tsx`)
  usa `log.error` per persistere ogni unhandled React error con
  `componentStack`, abilitando il debug post-incident.

**Negative**

- Disciplina manuale obbligatoria: ogni nuovo `console.*` introdotto da
  AI o da copia-incolla è un debito tecnico immediato. Mitigato da
  `eslint no-console` (configurato come error fuori da `lib/log.ts`).

## Verifica

```sh
grep -rn "console\." src --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/log.ts"
# Output atteso: vuoto.
```

Stato attuale: **0 occorrenze fuori da `src/lib/log.ts`**.

## Alternative scartate

- **`pino`**: ottimo lato server, overhead inutile lato browser.
- **`debug`**: solo on/off per namespace, nessuna correlazione utente.
- **`loglevel`**: niente record strutturato, niente sink.
