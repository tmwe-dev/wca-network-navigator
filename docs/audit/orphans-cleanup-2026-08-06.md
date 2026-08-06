# Cleanup file orfani — 2026-08-06 (Fase 4 del piano di refactoring)

## Metodo (doppia prova)
1. **Raggiungibilità**: grafo di import a partire da `src/main.tsx` più tutti i file di test.
   Risolti alias `@/`, path relativi, `index.*` di cartella e `import()` dinamici con stringa letterale.
   Risultato: 2.066 file raggiungibili su 2.520 → 484 non raggiunti.
2. **Prova testuale**: per ciascun candidato, ricerca del nome base in `src`, `e2e`, `scripts`,
   `public`, `index.html`, `supabase`. Scartati i file citati anche una sola volta (possibile uso dinamico).

Intersezione delle due prove: **205 file rimossi**. Elenco integrale in
`docs/audit/orphans-removed-2026-08-06.txt` (ripristinabili da git).

## Verifiche post-rimozione
- `tsgo --noEmit`: 0 errori
- build di produzione: OK
- lint-ratchet: 0 errori, warning 381 (budget abbassato da 420 a 381)
- test: 395 file, 3.154 test verdi
- smoke browser su `/v2/command`, `/v2/explore/contacts`, `/v2/inbox`, `/v2/settings`: render corretto

## Residuo
279 file restano non raggiungibili dal grafo ma citati altrove: vanno valutati caso per caso
in lotti successivi, non rimossi in blocco.

## Altre azioni della stessa sessione
- Libreria fogli di calcolo unificata su **ExcelJS**; dipendenza `xlsx` (SheetJS) rimossa.
- `scripts/bundle-size-guard.mjs`: budget reso reale (10.000 KB, misura 9.814 KB) da abbassare a ratchet.
