

## Diagnosi: Download Canvas non mostra i risultati in tempo reale

### Bug confermati

**Bug 1 — Pass 2 (Retry) non emette risultati alla Canvas**

Nel file `useDownloadProcessor.ts`, il Pass 1 (riga 278) emette correttamente i risultati:
```typescript
onResultRef.current?.({ partnerId, companyName, ... }); // ✅ Pass 1
```

Ma nel **Pass 2** (righe 345-355), dopo un retry con successo, **non c'è nessuna chiamata a `onResultRef.current`**. I profili vengono salvati nel database ma la Canvas non ne sa nulla. Se molti profili finiscono nella retry queue (rate-limit, page not loaded, extension error), l'utente vede il canvas vuoto nonostante il processore stia salvando dati.

**Bug 2 — Pass 2 non emette progress alla Canvas**

Sempre nel Pass 2, non c'è nessuna chiamata a `onProgressRef.current`. L'utente non vede la card "Estrazione in corso..." durante il retry, quindi sembra che il download sia fermo.

**Bug 3 — Skip/Error nel Pass 1 non emettono risultati completi**

Quando un profilo va in `rate_limited` o `retry`, viene emesso `emitSkip()` (riga 160, 180, 230, 237) che mostra il profilo come "skipped" nella canvas. Ma se poi il Pass 2 lo recupera con successo, il risultato positivo non viene mai aggiunto — l'utente vede solo lo skip iniziale.

### Correzioni

**File: `src/hooks/useDownloadProcessor.ts`**

1. **Pass 2 — Aggiungere `onProgressRef` prima dell'estrazione** (dopo riga 303):
   - Emettere progress con index e total della retry queue

2. **Pass 2 — Aggiungere `onResultRef` dopo il successo** (dopo riga 353):
   - Emettere il risultato con `profileSaved`, `emailCount`, `phoneCount`, `contactCount`

3. **Pass 2 — Emettere skip/fail** per i profili che falliscono anche il retry (righe 312, 314, 329-336):
   - Emettere `onResultRef` con `skipped: true` o `error`

Nessuna modifica alla pagina Campagne.

