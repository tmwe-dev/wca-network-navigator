
Obiettivo: spiegare perché i target `any = 0` e `disabled = 0` non sono stati raggiunti e cosa va corretto davvero per arrivarci.

Diagnosi reale emersa dall’audit statico:
- Non restano “pochi residui”: esistono ancora generatori strutturali di `any`.
- Il build/tsc oggi può essere verde, ma la type safety non è ancora chiusa ai confini del sistema: DAL dinamici, JSON liberi, API browser non tipizzate, test mocks.

Perché non arrivo a `any non-disabled = 0`:
1. `src/lib/supabaseUntyped.ts` usa ancora `(supabase as any).from(table)`. Finché esiste, tutto il layer RA (`useRADashboard`, `useRAJobs`, `useRAProspects`) continua a rigenerare cast e `any`.
2. `src/hooks/useSupabaseQuery.ts` ha ancora `FilterFn`, `query as any`, `data as any as Row[]`. È un moltiplicatore centrale: non basta ripulire i consumer.
3. In `src/data/partners.ts` e `src/data/partnerRelations.ts` esistono API pubbliche con `Promise<any[]>` e `select` dinamico. Se il contratto del DAL è `any[]`, i componenti a valle continueranno a castare.
4. Alcune props UI entrano già come `Record<string, any>`: `PartnerDetailCompact`, `PartnerCard`, `UnifiedActionBar`, `ContactEnrichmentCard`, `ContactRecordFields`. Quindi il problema nasce prima del render.
5. Alcuni residui sono boundary esterni non ancora incapsulati: Web Speech (`useContinuousSpeech`, `useAiVoice`), extension bridge (`useLinkedInExtensionBridge`, `TestDownload`), globals su `window` (`Operations`).

Perché non arrivo a `disabled = 0`:
1. Ho trovato 27 file con `/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */`. Questo da solo rende impossibile target zero.
2. Molti disable sono stati usati come tampone locale invece di chiudere la causa a monte: JSON Supabase, `select` dinamici, `window as any`, bridge payloads.
3. La config lint spinge in quella direzione: `@typescript-eslint/no-explicit-any` è `warn`, ma `npm run lint` usa `--max-warnings 0`. Quindi ogni `any` rimasto o viene tipizzato davvero, o viene silenziato.
4. Alcuni disable sono evitabili, ma solo dopo refactor di contratto; toglierli subito senza rifondare i tipi farebbe riesplodere lint o TypeScript.

Conclusione onesta:
- Non è che il target 0/0 sia “impossibile”.
- È che il lavoro fatto finora ha corretto soprattutto build, tsc e struttura file, ma non ha ancora eliminato i 4 generatori che ricreano `any` in cascata:
  - `src/lib/supabaseUntyped.ts`
  - `src/hooks/useSupabaseQuery.ts`
  - DAL con `select` dinamico / `Promise<any[]>`
  - props UI `Record<string, any>`
- Finché questi restano, i fix file-per-file abbassano il numero ma non lo azzerano.

Piano corretto per arrivare davvero a 0/0 o molto vicino:
1. Chiudere i generatori centrali:
   - sostituire `supabaseUntyped.ts` con wrapper generici o tipi RA locali;
   - riscrivere `useSupabaseQuery.ts` senza `any`.
2. Cambiare il contratto del DAL:
   - rimuovere `Promise<any[]>`;
   - usare funzioni generiche tipo `getPartnersByCountries<T>()` / `findPartnerContacts<T>()`.
3. Tipizzare i boundary esterni:
   - creare `src/types/web-speech.d.ts`;
   - definire schema dei messaggi per extension bridge;
   - eliminare `window as any`.
4. Portare nella UI view-model veri:
   - `PartnerWithRelations`
   - `PartnerCardModel`
   - `ContactEnrichmentData`
   - `ContactRecordUpdates`
5. Ripulire i test correttamente:
   - togliere i 27 file-level disable;
   - usare `unknown`, `Partial<T>`, `MockedFunction`, helper mock tipizzati;
   - lasciare solo disable locali e motivati se davvero inevitabili.
6. Solo alla fine rifare il conteggio e l’ultima passata sui residui.

Priorità tecnica immediata:
- Root blockers: `src/lib/supabaseUntyped.ts`, `src/hooks/useSupabaseQuery.ts`, `src/data/partners.ts`, `src/data/partnerRelations.ts`
- Boundary blockers: `src/hooks/useContinuousSpeech.ts`, `src/hooks/useAiVoice.ts`, `src/hooks/useLinkedInExtensionBridge.ts`, `src/pages/Operations.tsx`
- UI blockers: `src/components/partners/PartnerDetailCompact.tsx`, `src/components/partners/PartnerCard.tsx`, `src/components/partners/UnifiedActionBar.tsx`, `src/components/contacts/ContactEnrichmentCard.tsx`, `src/components/contact-drawer/ContactRecordFields.tsx`
- Test blockers: `src/test/wca-app-api.test.ts` e gli altri file con disable di intero file

Risposta breve alla tua domanda:
- Non ho mancato il target per un ultimo dettaglio.
- L’ho mancato perché la bonifica è stata fatta troppo dal bordo e non abbastanza dal nucleo.
- Se vuoi davvero 0/0, il prossimo blocco deve partire dai generatori centrali sopra, non da altri cast sparsi.
