## Piano secco

Correggo Command in 4 punti, così smette di fare domande inutili e usa davvero i risultati già trovati.

## 1. Fix immediato dei suggerimenti Command

Oggi i chip tipo `Arricchisci dati` generano un prompt generico, senza portarsi dietro i 9 partner trovati.

Cambio i suggerimenti generati dopo una ricerca partner in:

- `Prepara email di presentazione`
- `Prepara email collaborazione`
- `Arricchisci dati mancanti`

Niente più default `filtra per città` / `rating migliore` come prime opzioni.

## 2. Passaggio corretto del contesto

Quando Command trova partner, salva già `partnerIds`, paese e filtri nel `lastQueryResultContext`.

Collego i chip a quel contesto: se clicchi `Arricchisci dati` dopo Malta, il tool riceve direttamente i 9 partner Malta, non una frase vaga.

## 3. Batch enrichment reale, non conferma a vuoto

Creo/adeguo un tool Command tipo `batch-enrich-partners` che:

- prende i partner dall’ultima ricerca
- esclude quelli senza website
- arricchisce quelli con sito
- ritorna un report chiaro: completati / saltati / falliti

Se sono più partner, una sola conferma iniziale. Dopo la conferma esegue, non richiede di nuovo “vuoi arricchire?”.

## 4. Comunicazione-first + fuori holding pattern

Per i partner/contatti trovati, le prime azioni saranno operative:

1. email presentazione
2. email collaborazione
3. messaggio WA/LinkedIn
4. arricchimento dati mancanti

E di default gli invii escludono chi è nel circuito di attesa / holding pattern.

## File coinvolti

- `src/v2/ui/pages/command/lib/localResultFormatter.ts`
- `src/v2/ui/pages/command/aiBridge.ts`
- `src/v2/ui/pages/command/hooks/useFastLane.ts`
- `src/v2/ui/pages/command/hooks/useApprovalHandler.ts`
- `src/v2/ui/pages/command/tools/registry.ts`
- nuovo tool `src/v2/ui/pages/command/tools/batchEnrichPartners.ts`

## Nota importante

Non tocco `journalistReview`, email pipeline, né i guardrail già messi. Questo intervento è sul routing di Command e sui suggerimenti sbagliati.