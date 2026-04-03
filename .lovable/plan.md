

## Problema: Download lentissimo

Il collo di bottiglia principale è in `useContinuousSync.ts`:

```
if (p.status === "syncing" || p.status === "done") {
  queryClient.invalidateQueries({ queryKey: ["channel-messages"] });  // ← QUI
  queryClient.invalidateQueries({ queryKey: ["email-count"] });
}
```

Questo viene chiamato **ad ogni batch** (ogni singola email scaricata). Siccome `channel-messages` è la query paginata principale, ogni invalidazione forza un re-fetch completo dal database. Con centinaia di email, il browser passa più tempo a ri-interrogare il DB che a scaricare.

Inoltre il realtime in `useChannelMessages.ts` e `useDownloadedEmailsFeed.ts` già aggiunge le nuove righe nella cache locale — quindi l'invalidazione è **doppia e ridondante**.

## Piano di fix

### 1. Rimuovere invalidateQueries da useContinuousSync durante il syncing
- Durante `status === "syncing"`, il realtime già gestisce l'aggiornamento della lista
- Invalidare solo a `"done"` (fine sync) e `"error"`
- File: `src/hooks/useContinuousSync.ts`

### 2. Throttle email-count invalidation
- Invalidare `email-count` al massimo ogni 30 secondi durante il sync, non ad ogni batch
- File: `src/hooks/useContinuousSync.ts`

### 3. Rimuovere invalidateQueries da useCheckInbox
- Stessa logica: il realtime copre già gli aggiornamenti
- File: `src/hooks/useEmailSync.ts`

### File modificati
- `src/hooks/useContinuousSync.ts` — rimuovere invalidazioni durante syncing
- `src/hooks/useEmailSync.ts` — rimuovere invalidazioni ridondanti dal mutation onSuccess

