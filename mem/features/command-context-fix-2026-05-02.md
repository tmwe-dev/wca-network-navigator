---
name: Command Context Fix 2026-05-02
description: Fix perdita contesto chat → compose-email; filtri salvati, prompt naturale dopo approvazione, guardrail anti-falso partner
type: feature
---

## Problema risolto
Sequenza "Arabia Saudita → Amman → prepara un invito a tutti" non passava
i 31 partner di Amman a `compose-email`. Il tool cadeva nel ramo "singolo
partner" e cercava un'azienda chiamata "calcio" → 0 risultati.

## Cause
1. `executeApprovedStep` non passava `originalPrompt`/`history`/`contextHint`.
2. `compose-email` riceveva JSON serializzato e non trovava il testo naturale.
3. `lastQueryResultContext` salvava solo `partnerIds`+`countryCode`, non i
   filtri reali (es. `city=Amman`).
4. `isProceedIntent` non matchava "prepara un invito".
5. Nessun guardrail: invito generico → ricerca azienda fittizia.

## Fix
- `planRunner.executeApprovedStep` propaga `extras` (originalPrompt/history).
- `composeEmail.resolveNaturalPrompt` estrae il prompt da JSON o da context.
- `lastQueryResultContext` ora salva `table`, `filters`, `count`, `selectionLabel`.
- `useFastLane` arricchisce con `getLastSuccessfulQueryPlan().filters`.
- `composeEmail.fetchPartnersByFilters` rifa la query coi filtri salvati.
- `isProceedIntent` riconosce "invito/invitali/manda invito/a tutti".
- `looksLikeGenericInvite` blocca il fallback "estrai azienda" quando il
  prompt è un invito generico senza identificazione esplicita.

## Test
24/24 verdi in `lastQueryResultContext.test.ts`.
