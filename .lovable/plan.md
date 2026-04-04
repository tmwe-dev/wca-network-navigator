

# Piano di Refactoring: Stabilità e Fluidità dell'Applicazione

## Problema Principale

L'errore ricorrente `Failed to fetch dynamically imported module: Cockpit.tsx` è causato da:

1. **Cockpit.tsx è 651 righe** con 26 import — troppo pesante per un lazy-loaded module che viene caricato dentro un altro lazy-loaded module (Outreach → Cockpit = doppio lazy nesting)
2. **AIDraftStudio.tsx è 892 righe** — importato da Cockpit, crea una catena di dipendenze enorme
3. **WhatsAppInboxView.tsx (470 righe)** e **LinkedInInboxView.tsx (404 righe)** vengono caricati tutti eagerly dentro Outreach.tsx — nessun lazy loading per i tab
4. **Outreach.tsx** carica TUTTI i componenti tab eagerly anche se l'utente ne vede uno alla volta

## Piano di Intervento (4 step)

### 1. Lazy-load tutti i tab di Outreach

In `Outreach.tsx`, rendere lazy **ogni tab** (WhatsApp, LinkedIn, Email, Cockpit, AttivitaTab, InUscitaTab, HoldingPatternTab) così che venga caricato solo il componente del tab attivo.

```tsx
const WhatsAppInboxView = lazy(() => import("@/components/outreach/WhatsAppInboxView"));
const LinkedInInboxView = lazy(() => import("@/components/outreach/LinkedInInboxView"));
const EmailInboxView = lazy(() => import("@/components/outreach/EmailInboxView"));
// etc.
```

### 2. Spezzare Cockpit.tsx (651 → ~200 + hook)

Estrarre tutta la logica (handleDrop, AI actions, drag&drop, LinkedIn lookup flow) in un hook `useCockpitLogic.ts`. Il file `Cockpit.tsx` diventa solo rendering (~200 righe).

### 3. Spezzare AIDraftStudio.tsx (892 → ~300 + sotto-componenti)

Estrarre in sotto-componenti:
- `DraftPreview.tsx` — anteprima del messaggio
- `DraftEditor.tsx` — editor del testo
- `ScrapingProgress.tsx` — indicatore di fase scraping

### 4. Migliorare il recovery da chunk failure

Aggiornare `ViteChunkRecovery.tsx` per gestire meglio i retry dei lazy import con un wrapper che fa 2 tentativi prima di mostrare l'errore, evitando il reload completo della pagina.

```tsx
function lazyRetry(fn: () => Promise<any>) {
  return lazy(() => fn().catch(() => {
    return new Promise(resolve => setTimeout(resolve, 1500)).then(fn);
  }));
}
```

## Risultato Atteso

- Caricamento iniziale di Outreach: solo il tab attivo (Cockpit)
- Cockpit.tsx: da 651 a ~200 righe (logica in hook)
- AIDraftStudio: da 892 a ~300 righe (sotto-componenti)
- Nessun crash "Failed to fetch dynamically imported module" grazie al retry automatico
- Navigazione tra tab fluida con fallback di caricamento

