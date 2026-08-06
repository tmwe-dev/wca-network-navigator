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

## Secondo passaggio (cascata) — stessa data
Rieseguito il grafo dopo la prima rimozione: i non raggiungibili scendono da 484 a 197,
tutti citati testualmente altrove tranne 2, rimossi in cascata:
`src/components/outreach/scheduling/SequenceVisualizer.tsx`, `src/data/downloadViews.ts`.
Punto fisso raggiunto: nessun altro file ha zero riferimenti. I 195 residui restano
in osservazione (usi dinamici o riferimenti incrociati), non rimovibili senza prova.

## Ratchet dei budget consolidati
- `scripts/debt-budget.js`: any 17→**5**, eslint-disable 41→**26**, console 10→**9**.
- `scripts/lint-ratchet.mjs`: import diretti dal DAL 381→**362**.
- `scripts/bundle-size-guard.mjs`: 10.000→**9.900 KB** (misura 9.805 KB).

## Verifiche finali
typecheck 0 errori · lint-ratchet 0 errori / 362 warning entro budget ·
395 file di test, 3.154 test verdi · build di produzione OK · bundle 9.805 KB entro 9.900.
