

# Analisi Qualità — Da ~73.000 a 100.000/100.000

## Punteggio Stimato Attuale: ~73.000

| Area | Peso | Attuale | Max | Gap |
|---|---|---|---|---|
| Type Safety | 15.000 | 8.000 | 15.000 | -7.000 |
| Test Coverage | 20.000 | 11.000 | 20.000 | -9.000 |
| Code Architecture | 15.000 | 10.000 | 15.000 | -5.000 |
| Security | 15.000 | 13.500 | 15.000 | -1.500 |
| Code Hygiene | 10.000 | 8.500 | 10.000 | -1.500 |
| Edge Function Quality | 10.000 | 5.500 | 10.000 | -4.500 |
| E2E / Integration | 10.000 | 4.500 | 10.000 | -5.500 |
| Documentation | 5.000 | 3.500 | 5.000 | -1.500 |
| **TOTALE** | **100.000** | **~73.000** | **100.000** | **~27.000** |

---

## I 10 Gap da Colmare

### GAP 1 — Type Safety: 396× `as any` + 454× `: any` (−7.000 pt)
**146 file** con cast `as any`, **454 parametri** tipizzati `: any`.
- Peggiori: hooks Supabase (ogni query usa `as any` per aggirare i tipi generati)
- Fix: creare type helpers per le tabelle non in types.ts (agents, ai_memory, ecc.)
- Obiettivo: < 50 `as any` totali, 0 `: any` nei file non-test

### GAP 2 — Test Coverage: 1/343 componenti, 0/118 hooks (−9.000 pt)
| Layer | File | Con Test | % |
|---|---|---|---|
| Componenti | 343 | 1 | 0.3% |
| Hooks | 118 | 0 | 0% |
| Pagine | ~40 | 0 | 0% |
- Servono almeno: 20 component test, 10 hook test, 5 page test
- Priorità: i 6 mega-componenti (>500 LOC) + hooks critici

### GAP 3 — Mega-file Frontend: 8 file > 600 LOC (−5.000 pt)
| File | LOC |
|---|---|
| FiltersDrawer.tsx | 1.114 |
| BusinessCardsHub.tsx | 1.084 |
| AddContactDialog.tsx | 794 |
| useAcquisitionPipeline.tsx | 748 |
| EmailComposer.tsx | 729 |
| MissionStepRenderer.tsx | 700 |
| EmailComposerContactPicker.tsx | 685 |
| TestExtensions.tsx | 647 |
- Obiettivo: nessun file > 400 LOC (split in sub-componenti)

### GAP 4 — Mega-file Edge Functions: 5 funzioni > 700 LOC (−4.500 pt)
| Funzione | LOC |
|---|---|
| ai-assistant | 3.802 |
| scrape-wca-partners | 1.515 |
| check-inbox | 1.458 |
| generate-email | 1.048 |
| generate-outreach | 703 |
- `ai-assistant` da solo è quasi 4.000 righe → split in moduli
- Obiettivo: nessuna funzione > 500 LOC

### GAP 5 — Edge Function test: 19/67 con test (−3.000 pt)
- 48 funzioni senza alcun test
- Priorità: le 10 già identificate nello Step 1 del piano test
- Obiettivo: almeno 50/67 con test base (CORS + 401 + error shape)

### GAP 6 — E2E: 5/12 spec ancora skippate (−2.500 pt)
- Login fixture creato ma non ancora usato in tutti gli spec
- Obiettivo: 0 test skippati, 12/12 spec attivi

### GAP 7 — Security: 1 dangerouslySetInnerHTML senza sanitize (−1.500 pt)
- `src/components/ui/chart.tsx` usa dangerouslySetInnerHTML senza DOMPurify
- 3 occorrenze di `JSON.parse(JSON.stringify())` ancora presenti
- Obiettivo: 0 render HTML non sanitizzati, 0 deep clone naive

### GAP 8 — Code Hygiene: 3× JSON.parse(JSON.stringify) (−1.500 pt)
- Sostituire con `structuredClone()`
- 1 TODO/FIXME residuo
- Obiettivo: 0 pattern deprecati

### GAP 9 — Documentation: JSDoc mancante su hooks/utils (−1.500 pt)
- 118 hooks senza JSDoc
- Utility functions senza documentazione
- Obiettivo: JSDoc su tutti gli hooks pubblici e utility esportate

### GAP 10 — Missing Error Boundaries per pagine (−1.000 pt)
- Verificare che ogni pagina abbia error boundary
- Route protection già presente (withFeatureBoundary)

---

## Piano di Implementazione (in ordine di impatto)

### Fase 1: Type Safety (impatto: +7.000 pt)
1. Creare `src/types/database-helpers.ts` con tipi per tabelle mancanti
2. Eliminare `as any` dai hooks principali (useAgents, usePartners, ecc.)
3. Tipizzare i parametri `: any` nei componenti

### Fase 2: Test Coverage (impatto: +9.000 pt)
1. 20 component test per i file critici
2. 10 hook test (useAgents, usePartners, useEmailDrafts, ecc.)
3. 5 page test (render + routing)

### Fase 3: Refactoring Mega-file (impatto: +9.500 pt)
1. Split `ai-assistant` in moduli (tools, router, context, response)
2. Split `FiltersDrawer` in sub-componenti
3. Split `BusinessCardsHub` in sub-componenti
4. Refactor rimanenti file > 600 LOC

### Fase 4: Security + Hygiene (impatto: +3.000 pt)
1. Sanitizzare chart.tsx
2. Sostituire JSON.parse(JSON.stringify) → structuredClone
3. Aggiungere JSDoc ai hooks

### Fase 5: E2E Recovery (impatto: +2.500 pt)
1. Unskippare i 5 spec rimanenti
2. Validare login fixture in tutti gli spec

---

## Stima Finale

| Fase | Impatto | Effort |
|---|---|---|
| Type Safety | +7.000 | Alto (146 file) |
| Test Coverage | +9.000 | Alto (35+ file nuovi) |
| Refactoring | +9.500 | Molto alto (8 mega-file) |
| Security + Hygiene | +3.000 | Basso (5 fix) |
| E2E | +2.500 | Medio (5 spec) |
| **TOTALE** | **+~27.000** | — |

**Punteggio target: 100.000/100.000**
