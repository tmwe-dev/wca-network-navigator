## Diagnosi

Il sistema non ha “dimenticato” solo la chat: il contesto viene perso in 3 punti diversi.

1. **Il path con approvazione rompe il contesto**
   - Quando `compose-email` richiede approvazione, `executeApprovedStep()` rilancia il tool passando solo JSON/payload.
   - Non passa più `originalPrompt`, `history` e `contextHint`.
   - Quindi il tool non vede bene la conversazione precedente né il prompt naturale.

2. **`compose-email` interpreta male il prompt JSON**
   - Dopo approvazione riceve qualcosa tipo `{"prompt":"Ok adesso prepara un invito..."}` invece della frase pulita.
   - Non riconosce “invito” come comando di prosecuzione.
   - Cade nel fallback “singolo partner” e legge `di calcio` come azienda `calcio`.
   - Risultato: cerca un partner chiamato “calcio” e torna 0.

3. **La memoria dell’ultima query è troppo povera**
   - Oggi salva soprattutto `partnerIds` e `countryCode`.
   - Ma il tuo caso è: prima Arabia Saudita, poi **Amman**, poi “prepara invito a tutti”.
   - Serve salvare anche i filtri effettivi della query precedente: `table=partners`, `city=Amman`, eventuale paese/contesto ereditato, count, ids se disponibili.

## Correzione proposta

1. **Riparare `executeApprovedStep()`**
   - Aggiungo `extras` anche al ramo approvato.
   - Passo a `tool.execute()` sempre: `originalPrompt`, `history`, `contextHint`.
   - Così l’approvazione non cancella il contesto.

2. **Normalizzare l’input dentro `compose-email`**
   - Se il prompt è JSON con campo `prompt`, il tool userà quel testo naturale.
   - Se c’è `context.originalPrompt`, avrà priorità.
   - Stop alla ricerca accidentale di aziende tipo “calcio”.

3. **Allargare `isProceedIntent()`**
   - Aggiungo casi come: `invito`, `invita`, `prepara un invito`, `mandagli un invito`, `a tutti`, `tutti ospiti`, `quelli selezionati`, `quelli trovati`.
   - Questo intercetta esattamente il tuo comando.

4. **Salvare un contesto query strutturato**
   - Estendo `lastQueryResultContext` con:
     - `table`
     - `filters`
     - `count`
     - `selectionLabel` tipo “partner ad Amman”
     - `partnerIds` quando presenti
   - Non solo paese: anche città e filtri reali.

5. **Fallback DB dai filtri precedenti**
   - Se non ci sono `partnerIds`, `compose-email` rifà la query usando i filtri salvati (`city=Amman`, country se presente).
   - Quindi “prepara invito a tutti” lavora sui 31 di Amman, non su una nuova ricerca casuale.

6. **Guardrail anti-falso partner**
   - Se il prompt è un invito generico e c’è contesto precedente, vieto il fallback `extractPersonAndCompany()`.
   - In quel caso deve usare il contesto o dare errore chiaro: “non ho una selezione attiva”.

## Test da aggiungere

- `Arabia Saudita → Amman → prepara invito a tutti` usa i partner di Amman.
- Prompt approvato passa ancora `originalPrompt/history/contextHint`.
- `prepara un invito a fare una partita di calcio...` non cerca azienda “calcio”.
- Count query senza righe ma con filtri salva comunque `city=Amman`.

## File da toccare

- `src/v2/ui/pages/command/planRunner.ts`
- `src/v2/ui/pages/command/hooks/usePlanExecution.ts`
- `src/v2/ui/pages/command/tools/composeEmail.ts`
- `src/v2/ui/pages/command/lib/lastQueryResultContext.ts`
- `src/v2/ui/pages/command/hooks/useFastLane.ts`
- test relativi in `src/v2/ui/pages/command/lib/__tests__/`