---
name: Multi-Agent Debate Pattern
description: Pattern dibattito multi-agente con framework localizzato, skip logic consenso e convergence engine. Estratto da RadioChat e adattato per Command/Outreach TMWE.
type: standard
---

## Concetto
N agenti con personalità distinta partecipano a una conversazione, ognuno con un ruolo non sovrapponibile. Si convergono verso una risposta migliore tramite **build-on** (estendere) o **disagree** (controargomentare con dati).

## Schema personalità (5 dimensioni)
Ogni agente ha:
- `role` — ruolo professionale ("Analista Scientifico", "Filosofo Strategico", …)
- `style` — tono e registro ("diretto e pragmatico", "riflessivo e profondo", …)
- `strengths` — domini di forza
- `approach` — metodo operativo ("parti da fatti verificabili", "esplora le implicazioni profonde", …)
- `debateRule` — come dissentire ("presenta dati o casi studio", "identifica l'errore logico", …)

## Framework di dibattito (6 sezioni, localizzato)
1. `intro` — contesto multi-voce
2. `rules` — REGOLE: ascolta prima di rispondere, aggiungi VALORE NUOVO, costruisci o dissenti, tono collaborativo, OBIETTIVO = CONVERGERE
3. `consultation` — coordinamento esplicito
4. `buildOn` — costruisci sulle risposte precedenti
5. `disagree` — esprimi dissenso con argomenti
6. `conclude` — chiusura con contributo chiaro

## Skip logic (consenso multilingua)
Se gli ultimi N messaggi degli agenti contengono ≥ 2 marker di accordo (`concordo`/`agree`/`d'accord`/…) e l'ultimo turno utente NON contiene domande → **salta agenti ridondanti**. Riduce token e ridondanza.

## Convergence engine
Stato della conversazione classificato dopo ogni turno:
- `agreement` → "approfondisci aspetto inesplorato o critica posizione condivisa"
- `divergence` → "cerca sintesi che integri le prospettive migliori"
- `stagnation` → "porta un punto di vista COMPLETAMENTE NUOVO" (similarity > 0.55 su 2+ coppie)
- `neutral` → nessuna istruzione

## Adattamento TMWE
- Personas → `agent_personas` table (oggi 8 vuote — popolare con 5 dimensioni)
- DEBATE_FRAMEWORK → `_shared/prompts/debateFramework.ts` con SSOT 6 lingue
- Skip logic → opzionale in `agent-loop` (flag `enable_consensus_skip`)
- Convergence → utile per Command Page orchestrator (Director Luca)

## Vincoli TMWE
- Editorial review (`journalistReview`) resta obbligatorio sull'output finale email/WA/LI
- Hard guards rimangono attivi
- Ogni invocazione passa da `invokeAi()` con scope registrato