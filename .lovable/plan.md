# Bug: compose-email perde il contesto sul follow-up

## Cosa è successo nella tua chat

1. "Trovami i partner di Malta…" → AI Query Planner trova **9 partner MT** ✅
2. "vai avanti con la bozza della Lettera di invito" → compose-email parte
3. Il tool **non riconosce** che la conferma si riferisce ai 9 partner di Malta appena trovati → cerca "Lettera di invito" come ragione sociale → **0 risultati**

## Causa tecnica

`composeEmail.ts` ha solo 3 percorsi:
- **Country-wide batch**: serve sia `detectCountryCode(prompt)` (cerca "Malta" nel testo) **sia** `isCountryWideIntent(prompt)` ("tutti i partner di X"). Sul follow-up "vai avanti…" entrambi falliscono.
- **Regenerate intent**: matcha solo verbi tipo "rifai/riscrivi/fammele vedere". "vai avanti / procedi / conferma" **non sono coperti**.
- **Singolo partner**: estrae azienda dal prompt → trova "Lettera" → 0 risultati.

Inoltre `composerContext` viene scritto **solo** dopo un batch country-wide riuscito, non dopo un risultato dell'AI Query Planner. Quindi la lista dei 9 partner di Malta trovati al passo precedente **non è disponibile** al compose-email.

## Cosa cambio (solo frontend Command, niente backend)

### 1. Aggancio compose-email all'ultimo risultato del Query Planner
`useToolExecution` / `useFastLane` già conoscono l'ultimo `liveResult` della chat (la lista MT di 9 partner). Espongo la lista dei partner risultanti in un nuovo singleton modulo `lastQueryResultContext.ts` (TTL 5 min, stessa logica di `composerContext`) ogni volta che un tool query restituisce partner.

### 2. Nuovo intent "procedi/conferma"
Aggiungo a `composerContext.ts` un helper `isProceedIntent(prompt)` che matcha:
- "vai avanti", "procedi", "conferma", "ok procedi", "fai pure", "prepara la bozza", "scrivi la lettera", "go"

Quando matcha **e** esiste un `lastQueryResultContext` con partner, compose-email:
- usa quei partner come batch
- detecta il tono dal prompt corrente (default "professional")
- chiama `generateDraftsBatch` esattamente come fa oggi per il country-wide
- popola `composerContext` per consentire i successivi "rifai più amichevole"

### 3. Estendere `isRegenerateIntent` con "vai avanti/procedi"
In più aggiungo "continua", "prosegui", "ok" per coprire conferme brevi.

### 4. Fallback più chiaro
Se compose-email non trova partner e non c'è contesto, invece di `0 risultati` muto restituisce un report:
> "Non ho un elenco partner attivo. Riformula indicando il paese (es. 'scrivi ai partner di Malta') o conferma subito dopo una ricerca."

## File toccati

- `src/v2/ui/pages/command/lib/composerContext.ts` — nuovo `isProceedIntent`, estensione regex regenerate
- `src/v2/ui/pages/command/lib/lastQueryResultContext.ts` — **nuovo** singleton modulo (partnerIds + countryCode + ts)
- `src/v2/ui/pages/command/tools/composeEmail.ts` — nuovo ramo "proceed-with-context" prima del country-wide
- `src/v2/ui/pages/command/hooks/useFastLane.ts` (o equivalente che gestisce risultato query) — chiama `setLastQueryResultContext` quando il Planner restituisce partner
- Test: estendo `composerContext.test.ts` con casi proceed/continua/conferma

## Cosa NON tocco

- Edge function `generate-email` e `ai-query-planner` (zero modifiche backend)
- Pipeline Oracolo/Architetto/Giornalista
- Logica country detection esistente

## Risultato atteso sul tuo caso

"Trovami partner Malta" → 9 risultati → "vai avanti con la bozza della Lettera di invito" → genera **9 bozze personalizzate** (cap 12) per i partner MT, con tono coerente all'invito (Four Seasons / magazzini settembre), sfogliabili nel composer.
