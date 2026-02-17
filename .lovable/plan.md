

# Piano: Ridurre il timeout di sicurezza da 90s a 4s

## Problema
90 secondi di attesa per un profilo che non risponde sono troppi. Se l'estensione non risponde in 3-4 secondi, il profilo e chiaramente problematico e va saltato subito.

## Modifica

### File: `src/hooks/useDownloadProcessor.ts`

Cambiare il timeout da 90000ms a 4000ms (4 secondi):

```typescript
// Prima:
setTimeout(() => resolve({ success: false, error: "Timeout 90s", pageLoaded: false }), 90000)

// Dopo:
setTimeout(() => resolve({ success: false, error: "Timeout 4s", pageLoaded: false }), 4000)
```

Il profilo verra marcato come "skipped" e potra essere recuperato in un passaggio successivo. Il job prosegue immediatamente col profilo seguente senza perdere tempo.

Nessun altro file da modificare.

