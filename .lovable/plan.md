

## Piano: Feedback visivo durante la generazione alias

### Problema
Quando si lancia "Genera Alias", la funzione edge viene chiamata e al termine appare un toast di successo/errore. Ma durante l'esecuzione (che può durare diversi secondi) non c'è nessun feedback visivo — l'utente non sa se il sistema sta lavorando o si è bloccato.

### Soluzione
Aggiungere un **toast persistente** di tipo "loading" che appare immediatamente quando parte la generazione e si aggiorna al completamento. Questo approccio è leggero, non richiede nuovi componenti, e funziona sia in Operations che in Partner Hub.

### Modifiche

**File: `src/pages/Operations.tsx`** — `handleGenerateAliases`
- Mostrare subito un `toast.loading("Generazione alias in corso...")` con un ID fisso
- Al completamento, sostituirlo con `toast.success(...)` o `toast.error(...)` usando lo stesso ID

**File: `src/pages/PartnerHub.tsx`** — `handleGenerateAliases`
- Stesso pattern: toast loading immediato, poi success/error con lo stesso ID

### Dettaglio tecnico
```typescript
const toastId = toast.loading("Generazione alias in corso...");
try {
  // ... invoke edge function ...
  toast.success("Alias generati: ...", { id: toastId });
} catch {
  toast.error("Errore generazione alias", { id: toastId });
}
```

Sonner supporta nativamente `toast.loading()` e la sostituzione tramite `{ id }` — zero dipendenze aggiuntive.

