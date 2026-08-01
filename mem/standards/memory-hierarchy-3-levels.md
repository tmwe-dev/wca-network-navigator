---
name: Memory Hierarchy 3 Levels
description: Pattern memoria conversazionale a 3 livelli (Full/Condensed/Summary) con auto-summary trigger e token tracking. Estratto da RadioChat src/lib/memory.ts.
type: standard
---

## I 3 livelli
| Livello | Contenuto | Default count | Token target |
|---|---|---|---|
| L1 Full | Ultimi N messaggi completi | 20 | ~3000 |
| L2 Condensed | N messaggi medi → 1 riga "AgentName: posizione" | 20 (max 120 char) | ~1000 |
| L3 Summary | Tutto il resto compresso in blocchi cumulativi | trigger ogni 20 msg | ~800 char per blocco |

## Trigger auto-summary
`shouldTriggerSummary()` quando `messages.length % SUMMARY_TRIGGER === 0` e ci sono almeno `summaryThreshold` messaggi non ancora riassunti. Esecuzione **background non bloccante**.

## Condense rule
Prima frase del messaggio fino a `condensedMaxChars` (default 120) prefissata da `[Nome]: `.

## Token tracking
Stima `~4 char = 1 token`. Espone:
- `level1Count` / `level2Count` / `level3Summarized`
- `estimatedTokens` totali
- `maxContextTokens` (default 6000) come budget guard

## Storage RadioChat (da NON portare)
localStorage key `bartalk_summaries` per conversation_id. **In TMWE deve passare da Supabase + RLS** (tabella `conversation_summaries` o estensione di `cognitive_memory`).

## Confronto con TMWE L1-L3
TMWE ha già `cognitive_memory` con tier L1-L3 (vedi `mem://architecture/cognitive-memory-and-doctrine-governance`). Da verificare:
1. Esiste un trigger automatico di compressione? Se no, aggiungere.
2. Il summary cumulativo è esposto al prompt? Se no, integrare in `contextInjection`.
3. Token budget guard è enforced? Se no, aggiungere `maxContextTokens` per scope.

## Riferimento file fonte
`/tmp/radiochat/src/lib/memory.ts` (446 LOC).