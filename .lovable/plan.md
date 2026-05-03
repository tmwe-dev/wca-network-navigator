## Diagnosi del bug "1 sola mail invece di 9"

Riproduzione: hai chiesto "quanti partner a Malta" → AI ha risposto "9". Poi "voglio che prepari una mail…" → ha generato 1 sola bozza per "Thomas Smith".

Causa: il primo turno è una **count query** (`kind: "report"`, niente `rows`). Nel ramo Fast Lane (`useFastLane.ts` riga 108-147):
- `extractPartnerIdsFromResult` su un report ritorna `[]`
- `extractQueryMetaFromResult` su un report ritorna `filters: []`
- viene salvato `countryCode: "MT"` ma `count: null` e `partnerIds: []`

Nel turno successivo `composeEmail.execute`:
- `isProceedIntent("…prepari una mail…")` = true → entra nel ramo proceed
- `forceBatch` calcolato come `batchIntent || queryHasMany`
  - `batchIntent` = false (prompt non contiene "tutti/batch/ciascuno")
  - `queryHasMany` = false (partnerIds.length = 0, count = null)
- `forceBatch = false` → cade sul ramo single-partner → fallback `extractPersonAndCompany` → search casuale per company → trova "Thomas Smith" → 1 bozza

In più, `composeEmail.ts` è oggi a **996 righe** (il file più grande dell'app dopo i types generati): difficile da mantenere e propenso a regressioni come questa.

## Cosa propongo

### 1. Fix mirato batch-detection (priorità 1, 0 rischio nodo critico)

Nel ramo "proceed-with-context" di `composeEmail.execute`:
- considerare `forceBatch = true` anche quando `queryCtx.countryCode` è presente E il prompt non identifica un destinatario esplicito (`extractPersonAndCompany` non restituisce `email` né coppia `person+company` chiara). In quel caso si tratta inequivocabilmente del follow-up del set "9 partner di Malta".
- in `useFastLane`/`useSuperMarioFlow`, quando il risultato è un `kind: "report"` con un count numerico nel testo o nel meta, popolare `count` reale dentro `setLastQueryResultContext` così che `queryHasMany` funzioni anche per le count-query.

Nessuna modifica a `generate-email`, edge function, `Promise.allSettled`, deduplica, holding pattern, editorial review. Modifica locale e reversibile.

### 2. Refactor `composeEmail.ts` (priorità 2, file unico spezzato in moduli)

Spezzare il file 996 righe senza cambiare comportamento, estraendo per responsabilità:

```text
src/v2/ui/pages/command/tools/composeEmail/
  index.ts                       (Tool export, match + execute orchestrator, ~120 righe)
  intent.ts                      (extractPersonAndCompany, isCountryWideIntent,
                                  detectCountryCode, looksLikeGenericInvite,
                                  resolveNaturalPrompt, extractPartnersFromContextPayload)
  partnerLookup.ts               (searchPartner, searchPartnersByCountry,
                                  fetchPartnersByIds, fetchPartnersByFilters,
                                  findContact, fetchPrimaryContact)
  draftGenerator.ts              (generateOneDraft, generateDraftsBatch — UNICO punto
                                  che chiama generate-email, MAX_BATCH_DRAFTS, allSettled)
  pipelineBuilder.ts             (buildEmailPipeline, leadStatusNote, daysSince)
  resultBuilders.ts              (buildBatchComposerResult, buildSingleComposerResult,
                                  buildBlockedResult, buildDisambiguationResult)
```

Regole:
- nessun cambio di firma esposta verso `registry.ts` / `useFastLane` / `useSuperMarioFlow`
- nessuna duplicazione di chiamata `invokeEdge("generate-email", …)` — resta solo dentro `draftGenerator.ts`
- preservato l'ordine: 0a regenerate → 0b proceed-with-context → 0 country-wide → 1 single
- preservata la memoria `composerContext` e `lastQueryResultContext`
- preservato il guardrail blacklist e `looksLikeGenericInvite`

### 3. Audit codice morto — proposta (NON eseguito senza tua conferma)

Scan iniziale: ~20 file in `src/components/` con zero import nel resto del codice (es. `BackgroundSyncIndicator.tsx`, `CommandPalette.tsx`, intera cartella `acquisition/`, vari `agenda/*`, `agents/*`). Memoria progetto dice esplicitamente: "Do not delete unused code in `src/components/` as it may be in development".

Quindi propongo di NON cancellare nulla in automatico. Invece:
- generare un report `/mnt/documents/dead-code-audit.md` con: percorso, dimensione, ultima modifica git, eventuale pagina/route legata, stato (orfano / referenziato solo da test / referenziato solo da sé).
- tu decidi voce per voce cosa archiviare in `src/_deprecated/` e cosa tenere.

### 4. Altri file pesanti su cui posso intervenire dopo (solo segnalazione, non in questo giro)

- `src/v2/ui/pages/CestinonePage.tsx` 929 righe
- `src/v2/ui/pages/prompt-lab/hooks/useLabAgent.ts` 955 righe
- `src/components/email-intelligence/ManualGroupingTab.tsx` 644 righe
- `src/v2/ui/pages/command/canvas/ComposerCanvas.tsx` 572 righe

Li segnalo per un secondo giro di refactor, non li tocco ora.

## Check pre-claim "fatto"

- batch OK: 9 destinatari → 9 bozze
- dedup OK: nessuna chiamata `generate-email` duplicata per lo stesso partner
- ordine OK: 0a → 0b → 0 → 1 invariato
- memoria OK: `composerContext` e `lastQueryResultContext` invariati
- submit OK: `useCommandSubmit` non toccato
- fallback OK: ramo single resta intatto per i casi davvero singoli
- nessun side-effect duplicato: invio email, write DB, edge functions non toccati

## Nota su scroll

Non tocco `src/index.css` né l'overscroll-behavior già aggiunto.

## Domande prima di partire

1. Procedo con bug-fix + refactor moduli insieme, o preferisci prima solo il bug-fix e poi un secondo giro per il refactor?
2. Per l'audit codice morto: solo report markdown o vuoi che sposti già gli orfani evidenti in `src/_deprecated/`?