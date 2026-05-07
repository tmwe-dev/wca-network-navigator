# Audit sistemi di attivazione WhatsApp

## Mappa di tutti i punti che possono attivare/scaricare WA

| # | Componente | Tipo trigger | Stato | Azione |
|---|---|---|---|---|
| 1 | `useWhatsAppAutoSync` (background, `BackgroundServices`) | Automatico — sequenza 20/18/8/3/15/7/18/15/2/3/20 + pause 2/5/3/2 | Nuovo, attivo | **Keep — è il sistema canonico** |
| 2 | `useWhatsAppAdaptiveSync` (`syncFromCursor` / `readNow`) | Hook core di sync per-chat-cursor | Attivo | **Keep — unico motore di sync** |
| 3 | `WhatsAppSyncButton` (header globale) | Manuale, dispatcha `wa-sync-trigger` | Nuovo | **Keep — click globale richiesto** |
| 4 | `WhatsAppToolbar` dentro `InArrivoTab` (bottone "Sincronizza") | Manuale locale, chiama lo stesso `readNow` | Pre-esistente | **Keep ma riconvertito**: usa lo stesso hook, niente sistema parallelo. Solo etichetta + barra di progresso locale |
| 5 | `useWhatsAppBackfill` (`useWhatsAppBackfill.ts`) | Deep backfill cursor con `bridge.backfillChat` + scroll | Orfano: zero consumer in app | **Deprecare**: rinominare con commento `@deprecated`, escludere da bundle, lasciare il file per riferimento storico ma non usabile |
| 6 | `useAutoConnect` | Verifica sessione una sola volta | Pre-esistente | **Keep — non scarica messaggi, solo set flag connessione** |
| 7 | `useContinuousSync` / `useEmailAutoSync` | Email, non WA | Pre-esistente | **Keep, irrilevante** |
| 8 | `WhatsAppTest` (`/test-extensions`) | Pannello dev manuale (`readUnread`) | Pre-esistente, dev-only | **Keep — strumento di diagnostica, non in produzione** |

## Conclusione audit

Esiste **un solo sistema parallelo realmente da deprecare**: `useWhatsAppBackfill`.
- Nessun componente lo importa più (`rg useWhatsAppBackfill src` → solo definizione).
- Era nato per il deep-backfill manuale ma è stato sostituito dal cursor-based di `useWhatsAppAdaptiveSync` (che già opera con cursori per-chat e dedup `message_id_external`).
- `bridge.backfillChat` resta nel bridge per compatibilità ma non è più chiamato.

Tutti gli altri trigger condividono lo stesso motore (`useWhatsAppAdaptiveSync.syncFromCursor`) → non sono "sistemi" duplicati ma punti di ingresso allo stesso flusso.

## Modifiche da applicare

1. **Deprecare `src/hooks/useWhatsAppBackfill.ts`**
   - Aggiungere intestazione `@deprecated — sostituito da useWhatsAppAdaptiveSync`.
   - Marcare `export function useWhatsAppBackfill()` come `/** @deprecated */`.
   - Lasciare il codice (memoria progetto: non eliminare codice non usato sotto sviluppo, ma è esplicitamente sostituito → mantenere sorgente come riferimento storico, no rimozione fisica).

2. **Aggiungere ESLint guard leggera (commento)** nel file deprecato per scoraggiare nuovi import.

3. **Verifica finale**: nessun altro `setInterval` / `setTimeout` ricorrente legato a WA fuori da `useWhatsAppAutoSync`.

Nessuna modifica al motore di sync, al bridge, al bottone header, alla toolbar in `InArrivoTab` o a `useAutoConnect`. Zero rischio di regressione sul sync funzionante.

## File toccati
- `src/hooks/useWhatsAppBackfill.ts` (sola annotazione `@deprecated`, nessuna logica modificata)
