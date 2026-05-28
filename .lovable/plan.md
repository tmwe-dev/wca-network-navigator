## Stato attuale

I tre fix richiesti sono già stati applicati nel turno precedente:

1. **Smalltalk detector esteso** (`src/v2/ui/pages/command/lib/smalltalkDetector.ts`) — riconosce ora `c'è nessuno`, `c'è nessuno in ascolto`, `ce nessuno`, `c e nessuno`, varianti con `’`.
2. **TTS duplicato rimosso** (`src/v2/ui/pages/command/hooks/useCommandSubmit.ts`) — solo `CommandPage` legge i messaggi `Direttore`.
3. **Guard conversazionale** (`useCommandSubmit.ts`) — quando `plan.steps.length === 0`, ri-esegue `detectSmalltalk` su `rawText`/`text` prima di mostrare "Nessun piano possibile".
4. **18 unit test** in `smalltalkDetector.test.ts` — tutti verdi.

## Cosa farò in build mode

Operazione minima, nessun refactor:

1. **Re-run dei test** `bunx vitest run src/v2/ui/pages/command/lib/__tests__/smalltalkDetector.test.ts` per confermare che i 18 test passano sull'HEAD corrente.
2. **Smoke check manuale** del flusso in `useCommandSubmit.ts`: rileggo il file per confermare che il guard `plan.steps.length === 0` chiama `detectSmalltalk(rawText) ?? detectSmalltalk(text)` prima del fallback "Nessun piano possibile", e che non c'è più `ttsSpeak` duplicato nel ramo smalltalk.
3. **Nessuna modifica** a planner, fast-lane, SuperMario, registry tool, edge functions, DB, RLS, auth, prompt.

## Checklist nodi critici (invarianti)

- submit: invariato (solo guard aggiuntivo nel branch vuoto)
- memoria/history: invariata
- batch/dedup/pipeline: non toccati
- edge functions: non toccate
- side-effect duplicati: rimossi (TTS unico via CommandPage)
- ordine messaggi: invariato

## Output atteso

- "c'è nessuno", "c'è nessuno in ascolto", "ce nessuno" → risposta Direttore in tono conversazionale, una sola voce TTS.
- Frasi operative ("audit sistema", "cerca partner") → planner invariato.

Se i test falliscono o riscontro regressioni, mi fermo e segnalo prima di applicare altre modifiche.
