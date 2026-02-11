

# Fix: Lo scraper non rileva la sessione scaduta — soglia "Members only" troppo permissiva

## Problema trovato

Dai log del server, il profilo WCA ID 72850 mostra:
```
membersOnly=1x, contactBlocks=0, realNames=0, contactsAuth=false
```

Ma lo scraper lo tratta come "AUTH OK" perche' la condizione per dichiarare la sessione non valida e':
```
membersOnly > 2 || hasLoginPrompt
```

Significa che servono **3 o piu'** occorrenze di "Members only" per bloccare il download. Con 1 solo "Members only" (tipico di sessioni scadute), il sistema pensa che il membro semplicemente non abbia contatti e prosegue — scaricando dati vuoti.

Il job precedente (71727edd) con lo stesso cookie trovava 40 contatti su 83 profili. Il job nuovo (1aefb73e) ne ha trovato 0 su 1 — chiaramente la sessione si e' degradata.

## Correzione

### File 1: `supabase/functions/scrape-wca-partners/index.ts`

**Abbassare la soglia da `> 2` a `> 0`:**

Riga 600 — cambiare:
```typescript
return { html, membersOnly: membersOnlyCount > 2 || hasLoginPrompt, ... }
```
in:
```typescript
return { html, membersOnly: membersOnlyCount > 0 || hasLoginPrompt, ... }
```

Questo fa si' che anche una sola occorrenza di "Members only" venga segnalata come sessione non autenticata.

**Aggiornare la logica di auth (righe 816-821):**

La condizione `!result.membersOnly` ora sara' piu' rigorosa. Un profilo con `membersOnly >= 1` verra' correttamente identificato come sessione scaduta, anche se non ci sono blocchi `contactperson_row`.

### File 2: `supabase/functions/process-download-job/index.ts`

**Nessuna modifica necessaria** — il pre-auth check gia' usa `scrape-wca-partners` per il primo profilo. Con la soglia corretta, il job verra' messo in pausa se la sessione e' scaduta.

## Risultato atteso

- Con la nuova soglia, anche 1 "Members only" blocca il download
- Il job viene messo in pausa immediatamente
- L'utente riceve la notifica "Sessione scaduta"
- Niente piu' download di dati vuoti

## File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/scrape-wca-partners/index.ts` | Soglia membersOnly da > 2 a > 0 (riga 600) |

