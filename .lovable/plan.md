

# Piano: Sostituire Backfill con "Leggi Progressivo"

## Concetto

Eliminare tutta la logica complessa del backfill (ricerca contatto, scroll, parsing bolle) e sostituirla con chiamate ripetute a `readUnread` — lo stesso metodo affidabile del test. Il sistema chiama `readUnread` più volte con pause tra una chiamata e l'altra, salvando ogni batch. La deduplicazione deterministica (`buildDeterministicId` + `upsert` con `ignoreDuplicates`) impedisce automaticamente i duplicati. Il processo si ferma quando un ciclo non produce nuovi messaggi (= siamo arrivati a ciò che avevamo già).

## Come funziona

```text
Ciclo 1: readUnread → salva → 6 nuovi
Ciclo 2: readUnread → salva → 3 nuovi  
Ciclo 3: readUnread → salva → 0 nuovi → STOP (tutto allineato)
```

- Ogni `readUnread` legge la sidebar (passivo, affidabile)
- I messaggi già importati vengono ignorati dal DB (unique constraint su `message_id_external`)
- Dopo N cicli senza novità → completato
- Pausa di 5-10s tra un ciclo e l'altro (anti-detection leggero)
- Max 10 cicli per sessione (sicurezza)

## Dettagli tecnici

### File modificato: `src/hooks/useWhatsAppBackfill.ts`
Riscrittura completa — rimuovere:
- Tutta la logica `backfillChat` (ricerca, scroll, parsing)
- Le costanti `CHAT_DELAYS`, `LONG_PAUSE_*`, `MAX_CHATS_PER_SESSION`, `CIRCUIT_BREAKER_*`
- Le funzioni `sleepWithCountdown`, `randomBetween`
- Il loop per-contatto con sidebar parsing

Sostituire con:
- Loop semplice che chiama `readUnread()` ripetutamente
- Usa `saveMessages()` identico a `useWhatsAppAdaptiveSync` (upsert + ignoreDuplicates)
- Conta i nuovi per ciclo; se 0 per 2 cicli consecutivi → done
- Mantiene `sleepAbortable` per le pause tra cicli
- Progress semplificato: `{ status, cycle, totalCycles, recoveredMessages }`

### Nessuna modifica all'estensione
Il backfill ora usa solo `readUnread` — nessun nuovo action handler necessario.

### File `src/hooks/useWhatsAppExtensionBridge.ts`
Nessuna modifica — `readUnread` è già esposto e funzionante.

### File `src/components/outreach/WhatsAppInboxView.tsx`
Minima modifica: il bottone backfill (⬇️) resta, ma chiama il nuovo hook semplificato. I campi progress cambiano leggermente (da `currentChat/totalChats` a `cycle/totalCycles`).

## Limitazione nota

`readUnread` legge solo l'ultimo messaggio per chat dalla sidebar — non la cronologia completa. Ma è esattamente ciò che serve: cattura tutti i messaggi recenti che sono visibili nella sidebar, e il sistema li salva progressivamente. Per la cronologia profonda servirebbe comunque l'apertura delle singole chat.

## File coinvolti

| File | Azione |
|------|--------|
| `src/hooks/useWhatsAppBackfill.ts` | Riscrittura completa — loop readUnread progressivo |
| `src/components/outreach/WhatsAppInboxView.tsx` | Adattare UI progress al nuovo formato |

