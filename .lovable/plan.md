
# Piano: Timeout di sicurezza per l'estrazione profili

## Problema
Il job di download si blocca indefinitamente quando l'estensione Chrome non risponde per un singolo profilo. In questo caso il profilo #74441 (55esimo della lista US) ha causato il congelamento del sistema perche la risposta dall'estensione non e mai arrivata.

## Soluzione
Aggiungere un wrapper con timeout attorno alla chiamata `extractContacts` nel processore di download. Se l'estensione non risponde entro 90 secondi, il profilo viene automaticamente saltato (coerente con la politica Zero Retry) e il job prosegue con il profilo successivo.

## Dettagli tecnici

### File: `src/hooks/useDownloadProcessor.ts`

Alla riga 339, avvolgere la chiamata di estrazione in una Promise.race con un timeout di sicurezza:

```typescript
// Prima (riga 339):
const result = await extractContactsRef.current(wcaId);

// Dopo:
const extractionTimeout = new Promise<{ success: false; error: string; pageLoaded: false }>((resolve) =>
  setTimeout(() => resolve({ success: false, error: "Timeout 90s", pageLoaded: false }), 90000)
);
const result = await Promise.race([
  extractContactsRef.current(wcaId),
  extractionTimeout,
]);
```

Questo garantisce che:
- Se l'estensione risponde normalmente, il flusso resta invariato
- Se l'estensione non risponde entro 90s, il risultato sara `{ success: false, pageLoaded: false }`, che il codice esistente alla riga 345 gestisce gia come "profilo saltato"
- Il job non si blocca mai piu su un singolo profilo
- Zero Retry resta rispettato: nessun tentativo aggiuntivo, il profilo viene marcato come "skipped"

Nessun altro file da modificare.
