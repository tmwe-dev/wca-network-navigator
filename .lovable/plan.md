

# Modifica: 1 email per volta

## Cosa cambia
Una sola riga: `BATCH_SIZE` da `3` a `1` (riga 391 di `check-inbox/index.ts`).

```
const BATCH_SIZE = 1;
```

Il ciclo `useContinuousSync` sul frontend continuerà a chiamare la funzione in loop, ma ogni invocazione scaricherà e salverà **una sola email** prima di chiudere la connessione IMAP e rispondere. Questo riduce ulteriormente il rischio di timeout CPU.

Nessun'altra modifica necessaria — il checkpoint per messaggio e la sync continua sono già implementati.

