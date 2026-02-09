

# Fix: errore singolo interrompe scansione multi-paese

## Problema

Quando una richiesta di scansione fallisce (es. errore di rete temporaneo `Connection refused`), il codice esegue un `break` che:
1. Esce dal ciclo delle pagine per quel paese/network
2. Passa al network/paese successivo senza ritentare
3. Se Firecrawl e' temporaneamente irraggiungibile, TUTTI i paesi successivi falliscono a catena

Inoltre, il messaggio d'errore viene impostato (`setError`) ma mai resettato all'inizio di ogni paese, quindi l'errore di un paese potrebbe influenzare la visualizzazione dei successivi.

## Soluzione

### 1. Aggiungere retry con backoff nella scansione (DownloadManagement.tsx, ~riga 930)

Invece di fare `break` al primo errore, ritentare la richiesta fino a 3 volte con attesa crescente (2s, 4s, 8s). Solo dopo 3 fallimenti consecutivi, saltare quel paese e proseguire con il successivo (senza `break` che blocca tutto).

```text
// Retry logic per singola pagina
let retries = 0;
const maxRetries = 3;
let result = null;

while (retries < maxRetries) {
  try {
    result = await scrapeWcaDirectory(country.code, netKey, page);
    if (result.success) break;
    retries++;
    if (retries < maxRetries) await new Promise(r => setTimeout(r, 2000 * retries));
  } catch (err) {
    retries++;
    if (retries < maxRetries) await new Promise(r => setTimeout(r, 2000 * retries));
  }
}

if (!result?.success) {
  // Log errore ma CONTINUA con il prossimo paese
  console.warn(`Paese ${country.code} fallito dopo ${maxRetries} tentativi`);
  break; // esce solo dal while delle pagine, non dal for dei paesi
}
```

### 2. Resettare l'errore all'inizio di ogni paese (~riga 912)

Aggiungere `setError(null)` all'inizio del ciclo di ogni paese, cosi' un errore temporaneo non persiste visivamente.

### 3. Contatore errori visibile

Aggiungere un contatore di "paesi saltati per errore" visibile nell'UI, cosi' l'utente sa se qualche paese e' stato saltato e puo' riprovarlo.

### File modificati

- `src/pages/DownloadManagement.tsx`: retry logic + reset errore + contatore skip

