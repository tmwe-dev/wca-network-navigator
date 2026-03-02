

## Il bug reale: cascading timeout failure

### Cosa succede nei log

Job 74806099 mostra un pattern chiarissimo:
- Profili 1-7: caricano tutti in ~16s, restituiscono "member not found" con html=19917. OK.
- Profilo 8 in poi (#85839, #62345, #66996, ...): TUTTI html=0, Timeout 40s. NESSUNO carica.

Ma profilo #85839 nel job SUCCESSIVO (347b4457) carica al PRIMO tentativo con html=19917. Quindi non e un problema del profilo. E un problema di SEQUENZA.

### Causa root: il timeout 40s + la coda seriale = cascata di fallimenti

Ecco cosa succede riga per riga:

```text
Profilo 8 (#85839):
  T=0s:   extractContacts(85839) → enqueueExtraction → sendMessage parte
  T=40s:  Promise.race → il timeout40s vince → result = {error: "Timeout 40s"}
          MA sendMessage e ancora in corso nell'extension (60s timeout)
          LA CODA SERIALE e ancora LOCKED (busy=true)

Profilo 9 (#62345):
  T=41s:  extractContacts(62345) → enqueueExtraction → QUEUED (busy!)
  T=41s:  Il processor crea un NUOVO timeout40s che scade a T=81s
  T=60s:  Il sendMessage del profilo 8 finalmente scade (60s)
          La coda si sblocca, profilo 9 inizia ADESSO
  T=81s:  Il timeout40s del processor scade (40s da T=41)
          Ma il profilo 9 ha avuto solo 21s per caricare (non 40!)

Profilo 10:
  T=82s:  extractContacts → QUEUED
  T=82s:  Nuovo timeout40s scade a T=122s
  T=120s: sendMessage profilo 9 scade (60s da T=60)
          Profilo 10 inizia a T=120
  T=122s: Timeout scade → profilo 10 ha avuto solo 2 SECONDI!

→ Ogni profilo successivo ha MENO tempo perche la coda e bloccata
  dal sendMessage precedente che nessuno ha cancellato.
```

Il `Promise.race` con il timeout da 40s "abbandona" il risultato ma NON cancella il sendMessage sottostante. La coda seriale (`enqueueExtraction`) resta bloccata fino al timeout di 60s del sendMessage. Il profilo successivo viene accodato ma il suo timeout da 40s parte SUBITO, senza aspettare che la coda si liberi. Risultato: dopo il primo timeout, OGNI profilo successivo fallisce con tempo progressivamente minore.

### Fix

**Rimuovere il `Promise.race` con il timeout da 40s.** Il `sendMessage` ha gia un timeout di 60s che copre tutti i casi. Il timeout nel processore e ridondante e causa la cascata.

File da modificare:

**1. `src/hooks/useDownloadProcessor.ts`** — Rimuovere `timeout40s` e `Promise.race`, fare `await extractContactsRef.current(wcaId)` diretto. Stessa cosa nel retry loop.

**2. `src/hooks/useExtensionBridge.ts`** — Aumentare il timeout di `extractContacts` da 60s a 90s per coprire il caso peggiore (30s tab load + 1.5s script + margine).

