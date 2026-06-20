# Piano: Command AI senza binari hardcoded

## Diagnosi
Oggi il Command non è "AI-driven": è un programma a regole con l'AI relegata a comparsa. Ci sono **6 strati hardcoded** che intercettano il prompt PRIMA che l'AI ragioni, e spesso si contraddicono — è la causa del dialogo che si rompe ("quanti partner" → "in Italia?" non capisce più di cosa parliamo).

Strati hardcoded attuali (tutti da rimuovere/snellire):

```text
prompt utente
  │
  ├─ 1. detectSmalltalk()         regex saluti/grazie → risposta finta
  ├─ 2. normalizePrompt()          mappe refusi hardcoded
  ├─ 3. looksLikeSimpleQuery()     regex verbi/sostantivi → sceglie la corsia
  ├─ 4. aiQueryTool.match()        regex azioni vs letture
  ├─ 5. parseLocalIntent()         ENTITY_PATTERNS + COUNTRY_CODE_BY_NAME
  │                                + buildHintFromDurableContext (hint sintetici)
  └─ 6. localResultFormatter       COUNTRY_LABELS + template count/list
```

Il problema NON è l'edge function `ai-query-planner`: quella è già AI-native (riceve schema live dal DB, nessun esempio rigido). Il problema sono i 6 strati client che la scavalcano e perdono il contesto del dialogo.

## Obiettivo
Un solo cervello: l'**AI planner**, che riceve `prompt + storia completa della conversazione + schema live + scopo tabelle (KB)` e decide TUTTO (tabella, filtri, count vs list, se è smalltalk, se è azione). Il client diventa un trasporto sottile: invia, esegue il piano validato, mostra il risultato.

## Cosa si elimina (deadcode hardcoded)
- `lib/localIntentParser.ts` → **eliminato** (ENTITY_PATTERNS, COUNTRY_CODE_BY_NAME, COUNT_RE/LIST_RE).
- `buildHintFromDurableContext()` e gli hint sintetici "CONTESTO TURNO PRECEDENTE: tabella=..." in `aiQueryTool.ts` → **eliminati**.
- `aiQueryTool.match()` con i pattern azione/lettura → ridotto a sempre-disponibile (il planner decide INVALID).
- `usePromptAnalysis.looksLikeSimpleQuery()` regex → **eliminata**; il routing fast-lane non dipende più da regex di dominio.
- `lib/lexicalNormalizer` mappe refusi hardcoded → rimosse dal percorso (normalizzazione tipografica neutra soltanto, niente "pane→partner").
- `localResultFormatter` mappe `COUNTRY_LABELS` e template → sostituiti: il commento parlato lo genera l'AI con i dati reali (con fallback minimo non-semantico).
- `COUNTRY_LOOKUP` duplicata in `useFastLane.ts` → rimossa.
- `detectSmalltalk()` regex → il planner riconosce smalltalk e ritorna una risposta conversazionale (niente tabella).

NB: NON si tocca la sicurezza. Restano intatti: whitelist tabelle (`ALLOWED_TABLES`), solo-SELECT, validazione colonne/enum nel `safeQueryExecutor`, RLS. La libertà dell'AI è nel *cosa* chiedere; i *guardrail* restano in codice.

## Come diventa il flusso
```text
prompt utente + storia completa (DB-backed)
        │
        ▼
ai-query-planner (AI + schema live + scopo tabelle + storia)
        │  decide: smalltalk | INVALID(azione) | 1..N QueryPlan
        ▼
safeQueryExecutor (whitelist, solo SELECT, valida colonne/enum)  ← guardrail
        ▼
risultato → commento AI sui dati reali (TTS)
```

Il contesto del dialogo non viaggia più come "hint sintetico" fragile: l'AI riceve **la storia reale dei messaggi** (già persistita via `useConversation`) e segue il filo da sola. "Quanti partner?" → "in Italia?" funziona perché l'AI legge il turno precedente, non perché una regex ha indovinato `tabella=partners`.

## Passi tecnici
1. **Planner come unica autorità** (`supabase/functions/ai-query-planner/index.ts`):
   - Estendere l'output con un ramo `kind:"smalltalk"` + `reply` (l'AI risponde a saluti/chiacchiere senza query).
   - Rafforzare la sezione "CONTESTO" del system prompt: usare la storia messaggi per i follow-up ellittici (già passata, ora diventa il meccanismo primario).
   - Mantenere il post-processing count/list (è un'ottimizzazione DB innocua, non un binario semantico).
2. **aiQueryTool.ts**: rimuovere `buildHintFromDurableContext`, semplificare `match()` (sempre candidato lettura), gestire il nuovo `kind:"smalltalk"`.
3. **useCommandSubmit.ts**: rimuovere lo short-circuit `detectSmalltalk` e il routing `looksLikeSimpleQuery`/`isElliptical`. Tutte le richieste non-azione passano dal planner con storia completa; il planner stesso classifica smalltalk/INVALID/query.
4. **useFastLane.ts**: rimuovere `COUNTRY_LOOKUP`; il contesto durevole si popola dai filtri reali del piano (già disponibili), non da regex sul prompt.
5. **localResultFormatter.ts**: sostituire i template con un riepilogo generato dai dati reali del risultato (count + nomi tabella reali). Niente mappe paese hardcoded.
6. **Cleanup**: eliminare `localIntentParser.ts` + i suoi test, aggiornare `usePromptAnalysis`, rimuovere le mappe refusi semantiche da `lexicalNormalizer`.
7. **Verifica**: build, e poi test live della sequenza "quanti partner" → "in Italia" → "e in USA" → "grazie" (smalltalk) dal preview.

## Rischi e mitigazioni (nodi critici: orchestratore AI + memoria/history)
- Più richieste passano dal planner → più chiamate AI. Mitigazione: il post-processing count/list resta; storia limitata agli ultimi N turni significativi; 1 retry su 429 già presente.
- Rate-limit (429): invece del vecchio fallback deterministico che "indovinava", il sistema mostra un errore chiaro e ritenta — coerente con la richiesta dell'utente di NON avere binari finti.
- Reversibilità: ogni rimozione è locale; i guardrail di sicurezza non vengono toccati.

## Risultato atteso
L'AI riceve informazioni (schema, scopo tabelle, storia) e risolve liberamente. Niente regex che decidono il significato. Il dialogo è continuo perché l'AI legge la conversazione vera.
