# Audit profondo — regressioni post-fix "operatore + inbox"

## Sintomo confermato (screenshot)
- `/v2/funnemail-inbox` mostra spinner permanente con contatore "0 · Tutte le email".
- Header in alto a dx: `Viewing: Luca Arcanà` → modalità impersonation attiva.
- Schermo grigio della sessione precedente: oggi non più, ma resta lo stato "0 mail".

## Findings (priorità decrescente)

### F3 — Disallineamento operatore tra Inbox classica e Funnemail [CRITICO — root cause schermata vuota]
- `useFunnemailInbox` interroga sempre con `user.id` (utente loggato).
- `InArrivoTab` invece passa `activeOperator.user_id` (rispettando il switcher).
- In modalità "Viewing: altro operatore" Funnemail filtra ancora sul tuo `user_id` → 0 risultati se l'utente loggato non ha email proprie.

### F6 — Query key drift su Funnemail [ALTO]
`useFunnemailInbox` usa `queryKeys.funnemailInbox.grouped(...)` per leggere, ma le 5 invalidazioni sono hard-coded `["funnemail-inbox"]`. Se il prefix centralizzato non combacia, dopo bulk/override/reclassify la lista resta stantia.

### F2 — `ActiveOperatorContext`: persistenza fragile [MEDIO]
- Doppia lettura/parse di `localStorage` negli initializer.
- L'effect "default a currentOp" può sovrascrivere la scelta persistita in race con il caricamento async di `currentOp`.
- `STORAGE_KEY` dichiarato dentro al componente.

### F4 — `useFunnemailInbox`: recovery filtri "una sola volta" [MEDIO]
`didRecoverEmptyFiltersRef` non si resetta. Se l'utente in seguito riapplica un filtro che svuota la lista, il sistema non recupera più. Reset silenzioso → UX confusa.

### F5 — Tab inattivi in `FunnemailInboxPage` [MEDIO]
"Urgenti / In agenda / Commerciali" sono presenti nei tab ma in `useFunnemailInbox` cadono nel ramo `return base` → identici a "Tutte". Tab che non fanno nulla.

### F7 — Auto mark-as-read: rischio loop al rimount [BASSO]
`autoReadDoneRef` (Set in ref) si svuota al rimount → possibile rimarcatura inutile.

### F1 — Resizable: blindare commento [BASSO]
`ui/resizable.tsx` riportato a function components standard. Aggiungere doc-comment che vieta forwardRef per prevenire ricaduta.

### F8 — Smoke test mancante [BASSO]
Nessun test E2E protegge `/v2/funnemail-inbox` con/senza impersonation.

## Piano di ripristino (commit atomici, in ordine)

1. **F3** — In `useFunnemailInbox` calcolare `targetUserId = viewingAll ? null : (activeOperator?.user_id ?? user.id)`, passarlo a `listFunnemailGroupedInbox` e includerlo nella `queryKey`. Adeguare il DAL `src/data/funnemailInbox.ts` se necessario (param opzionale; se `null` → query "tutti gli operatori" rispettando RLS).
2. **F6** — Sostituire le 5 `invalidateQueries(["funnemail-inbox"])` con `queryKeys.funnemailInbox.root`. Verificare/estendere `src/lib/queryKeys.ts`.
3. **F2** — Refactor minimale: `STORAGE_KEY` modulo-level, una sola lettura `localStorage` con try/catch unico, mantenere il fallback a `currentOp.id` solo se nulla è persistito E `viewingAll === false`.
4. **F4** — Rimuovere il flag "una volta sola"; aggiungere toast `"Filtri resettati: nessun risultato"` quando scatta il recovery.
5. **F5** — Nascondere i tab "Urgenti / In agenda / Commerciali" finché non implementati (decisione: hide vs implement; default = hide per non rompere il contratto dei dati).
6. **F1** — Aggiungere commento doc in `ui/resizable.tsx`: "react-resizable-panels gestisce i ref internamente, non avvolgere in forwardRef".
7. **F7** — Spostare `autoReadDoneRef` su `Map<id, timestamp>` con TTL 10 min, oppure flag locale sul messaggio in cache.
8. **F8** — Smoke test Vitest sul mount di `FunnemailInboxPage` con e senza `viewingAll`.

## Vincoli rispettati
- Nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria).
- Nessuna alterazione a `journalistReview` o pipeline AI.
- Nessun cambio DB/RLS richiesto.
- Cambi solo frontend + DAL.

## File toccati
- `src/v2/hooks/useFunnemailInbox.ts`
- `src/contexts/ActiveOperatorContext.tsx`
- `src/data/funnemailInbox.ts` (firma)
- `src/lib/queryKeys.ts` (verifica)
- `src/v2/ui/pages/FunnemailInboxPage.tsx` (tab visibility)
- `src/components/ui/resizable.tsx` (commento)

## Cosa NON faremo
- Nessuna implementazione "Urgenti/Agenda/Commerciali" reale (richiede signal DB dedicati: separato).
- Nessun refactor del sistema globale di filtri.
- Nessuna modifica all'edge `funnemail-classify`.
