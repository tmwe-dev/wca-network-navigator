## Obiettivo

Far sì che il Command "segua il discorso": dopo "quanti partner" (o "quanti partner a Malta"), i follow-up ellittici come "e in Francia?", "Spagna", "e la Germania?", "quanti in Italia" devono ereditare automaticamente l'entità (partner) ed essere risolti dal parser deterministico locale — niente hop AI lento, niente risposta generica "Risultato disponibile nel canvas".

## Diagnosi (verificata dal vivo)

- Il parser locale gestisce correttamente i follow-up SE riceve l'hint di contesto (verificato con test puri).
- A runtime l'hint viene costruito SOLO da `queryContext` (stato React volatile). Sui follow-up ellittici quello stato a volte risulta vuoto/non fresco → il parser locale ritorna `null` → si cade sull'AI planner (3.98s) → commento generico senza voce.
- Esiste già `lastQueryResultContext` (singleton di modulo, TTL 5 min, contiene `table` + `filters`): è durevole tra i render ma NON viene usato per costruire l'hint.

## Modifiche (minime, locali, reversibili)

### 1. Fonte di contesto durevole nel parser locale
File: `src/v2/ui/pages/command/tools/aiQueryTool.ts`
- Prima di chiamare `parseLocalIntent`, se `context?.contextHint` è assente o non contiene `tabella=`, sintetizzare un hint dal contesto durevole leggendo `getLastQueryResultContext()`:
  - costruire la stringa nello stesso formato che `detectContext` si aspetta: `CONTESTO TURNO PRECEDENTE: tabella=<table>, mode=<count|list>, filtri=[...]`.
  - `mode` derivato dalla presenza di `count` (default `count`).
- Usare questo hint sintetizzato come fallback per `parseLocalIntent`, sia nel primo tentativo sia nel fallback post-429.
- Nessuna modifica al flusso AI esistente: il planner resta come ultimo fallback.

### 2. Non azzerare il piano prima di salvarlo come contesto
File: `src/v2/ui/pages/command/hooks/useFastLane.ts`
- Oggi `onContextUpdate()` (che fa `clearLastSuccessfulQueryPlan()`) viene chiamato PRIMA del blocco che legge `getLastSuccessfulQueryPlan()` per arricchire `lastQueryResultContext` (riga ~117), che quindi riceve `null`.
- Spostare `onContextUpdate()` DOPO il salvataggio di `lastQueryResultContext`, così sia `queryContext` sia `lastQueryResultContext` ricevono tabella+filtri reali. Questo rende il contesto durevole sempre popolato → il fix #1 ha sempre da cui ereditare.

### 3. Commento locale per i conteggi (no "Risultato disponibile nel canvas")
File: `src/v2/ui/pages/command/hooks/useResultCommentary.ts`
- Quando il risultato è un conteggio con tabella nota (es. partners) e il commento AI fallisce/è rate-limited, generare localmente la frase parlata specifica (es. "Abbiamo 99 partner in Francia.") invece del fallback generico. Riusa le label già presenti (`TABLE_LABEL`, `COUNTRY_CODE_BY_NAME`).

### 4. Test di regressione
File: `src/v2/ui/pages/command/lib/__tests__/localIntentParser.test.ts` (estensione)
- Aggiungere casi: con contesto `tabella=partners,mode=count`, i prompt "e in Francia?", "Spagna", "e la Germania?", "quanti in Italia" ritornano un piano `partners` col `country_code` corretto.
- Caso negativo invariato: senza contesto né entità, "quanti in USA?" → `null`.

## Fuori scope

- Nessuna modifica a edge function (`ai-query-planner`, `super-mario`), submit, batch, dedup, invio email, RLS, DB.
- Nessun refactor dei 4 sistemi di contesto: si collega solo `lastQueryResultContext` come fonte di fallback per l'hint.

## Verifica

- Test unitari verdi.
- Riproduzione dal vivo nella preview: `quanti partner` → `e in Francia?` → `Spagna` → `e in Germania?` devono rispondere via fast-lane locale (<1s, niente "Risultato disponibile nel canvas") con risposta parlata specifica.
- Controllo non-regressione: `quanti partner a Malta` → `quanti in Italia` continua a funzionare.
