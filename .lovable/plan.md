

# Fix: Cruscotto mancante, indicatore sessione errato, terminale inattivo

## Problemi identificati

### 1. Indicatore sessione mostra "Non configurato" (ma la sessione e' OK)
Nel database lo stato e' `ok` e il cookie `.ASPXAUTH` e' presente. Il problema e' nel componente `WcaSessionIndicator.tsx` riga 42: la label `"Non configurato"` viene mostrata per qualsiasi stato che non sia `"ok"` o `"expired"` -- incluso `"checking"` che e' il valore di default durante il caricamento iniziale. Dato che la query React ha `refetchInterval: 5min`, se il primo caricamento e' lento l'utente vede "Non configurato" anche con sessione attiva.

### 2. Cruscotto statistiche non appare
La barra delle statistiche globali (Paesi scansionati, Partner, Email, Telefoni) dipende dalla query `ops-global-stats`. Se la query e' in corso o lenta, il blocco `{globalStats && (...)}` non rende nulla e sembra che il cruscotto sia "scomparso". Serve un placeholder/skeleton durante il caricamento.

### 3. Terminale non processa nulla
Non e' un bug: nel database ci sono 40 job cancellati e 34 completati, zero job `pending` o `running`. Il processore funziona correttamente ma non ha nulla da fare. Il terminale dovrebbe mostrare un messaggio chiaro quando non ci sono job attivi.

## Correzioni

### File: `src/components/download/WcaSessionIndicator.tsx`

Riga 42 -- correggere la mappa delle label per coprire tutti gli stati:
- `"ok"` -> "WCA Connesso"
- `"expired"` -> "Sessione Scaduta"
- `"checking"` -> "Verifica..." (con icona di loading)
- `"no_cookie"` -> "Non configurato"
- `"error"` -> "Errore connessione"

Anche il colore del dot deve cambiare: `"checking"` deve avere un colore giallo/ambra, non rosso.

### File: `src/pages/Operations.tsx`

Aggiungere uno skeleton/placeholder per il cruscotto statistiche durante il caricamento:
- Mentre `globalStats` e' undefined (query in corso), mostrare una barra con skeleton animati
- Cosi' il layout non "salta" e l'utente vede che sta caricando

### File: `src/components/download/DownloadTerminal.tsx`

Aggiungere un messaggio quando non ci sono job attivi:
- Se non ci sono job running/pending, mostrare "Nessun job attivo. Seleziona un paese e avvia un download."

## Dettaglio tecnico

### WcaSessionIndicator -- nuova logica label/colore

```
// Riga 39-42, sostituire con:
const dotColor = isOk
  ? (isDark ? "bg-emerald-400" : "bg-emerald-500")
  : status === "checking"
    ? (isDark ? "bg-amber-400" : "bg-amber-500")
    : (isDark ? "bg-red-400" : "bg-red-500");

const label = isOk
  ? "WCA Connesso"
  : status === "expired"
    ? "Sessione Scaduta"
    : status === "checking"
      ? "Verifica..."
      : status === "no_cookie"
        ? "Non configurato"
        : "Errore";
```

### Operations.tsx -- skeleton cruscotto

Sostituire `{globalStats && (...)}` con un blocco che mostra sempre la barra, con skeleton se i dati non sono ancora pronti. Usare `Skeleton` da `@/components/ui/skeleton`.

### DownloadTerminal.tsx

Aggiungere controllo: se nessun job attivo, mostrare messaggio "idle" invece del terminale vuoto.
