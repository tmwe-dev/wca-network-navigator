# BATCH 3 — Audit e consolidamento V1→V2 (2026-07-31)

Metodo: grafo import completo (`src` + `e2e` + `scripts`, alias `@/`, import
statici e dinamici) + confronto per basename tra `src/**` (v1) e `src/v2/**`,
con hashing del contenuto normalizzato (commenti/spaziatura rimossi).

## Metriche

| Metrica | Valore |
|---|---|
| File TS/TSX analizzati | 2.503 |
| Coppie v1/v2 per basename | 281 |
| Candidati dopo filtro nomi generici (`types/utils/index/...`) | 32 |
| Coppie con contenuto identico | 0 |
| Duplicati confermati eliminabili | 2 |
| File rimossi | 2 |
| LOC rimosse | 340 |
| Export consolidati su implementazione canonica | 1 (`PageErrorBoundary`) |
| Caller migrati | 0 (nessun caller esistente sui file rimossi) |
| File orfani totali (0 importer) | 282 |

## Classificazione dei candidati

### Duplicati eliminabili (rimossi)

| File rimosso | Canonico | Evidenze |
|---|---|---|
| `src/v2/ui/atoms/PageErrorBoundary.tsx` (44 LOC) | `src/components/ui/PageErrorBoundary.tsx` | 0 importer; tutte le pagine v2 (`RubricaWhatsAppPage`, `EmailComposerPage`, …, 12 caller) importano già la versione v1, che è l'unica con logging strutturato + Sentry e `fallback`. Header fuorviante del canonico corretto. |
| `src/v2/ui/pages/email-forge/DeepSearchCanvas.tsx` (296 LOC) | `src/components/operations/DeepSearchCanvas.tsx` (6 caller) + `SherlockCanvas` | 0 importer, export rinominato `n` (residuo di build), backup e procedura di rollback già documentati in `src/v2/io/extensions/_backup/2026-04-20-firescrape-v1/README.md`. |

### Implementazioni distinte (nessuna azione)

| Coppia | Motivo |
|---|---|
| `components/shared/EmptyState` · `components/ui/EmptyState` · `v2/ui/atoms/EmptyState` | Tre API diverse (LucideIcon+primary/secondary action con motion; icon ReactNode + `action{label,onClick}`; icon ReactNode + `action: ReactNode`). Unificare cambierebbe markup e UX. Tutte e tre hanno caller/test attivi. |
| `lib/api/rateLimiter` · `v2/services/sherlock/rateLimiter` | Superfici disgiunte: circuit breaker generico (`withRateLimit`, `CircuitOpenError`) vs throttling per canale Sherlock (`throttle`, `estimateWaitMs`). |
| `lib/import/fileParser` · `v2/ui/pages/prompt-lab/utils/fileParser` | Domini diversi: parsing CSV/XLSX per import contatti vs estrazione testo (pdf/docx/md) per Prompt Lab. |
| `components/email-intelligence/FunnemailTab` · `v2/ui/pages/email-lab/FunnemailTab` | Due pagine attive distinte (`EmailIntelligencePage` vs `EmailLabPage`), contenuti diversi. |
| `components/…/ActiveFiltersBar` · `v2/ui/molecules/ActiveFiltersBar` | Contratti di filtro diversi (manual grouping vs company list); entrambi con caller attivi. |
| `components/shared/entity-toolbar/useActiveFilterChips` · `v2/hooks/companyList/useActiveFilterChips` | Store e chip set differenti; 2 caller attivi ciascuno. |
| `src/data/*` · `src/v2/io/supabase/{queries,mutations}/*` (activities, agents, blacklist, contacts, operators, partners, prospects, cockpit, deepSearch, diagnostics) | Due layer DAL coesistenti, entrambi allowlisted dal guard architetturale. Il consolidamento richiede la migrazione dei consumer v2 e non è un'operazione "sicura" a comportamento invariato: rimandato a un batch dedicato per dominio. |

### Archivio intenzionale (nessuna azione)

`src/v2/ui/pages/command/_legacy/**` (8 file, 1.089 LOC): documentato in
`CommandPage.tsx` come archivio volontario per il futuro "next best action".
Nessuna cancellazione: la regola vieta di eliminare in base al solo nome.

### Incerto — lasciato invariato

42 hook `src/v2/hooks/**V2.ts` senza importer (es. `useCockpitLogicV2`,
`useBlacklistV2`, `useDiagnosticsV2`). La loro rimozione era già stata proposta
in un batch precedente e **respinta dall'utente**: restano invariati e
continuano a fare da consumer del DAL v2 (mantengono i moduli
`src/v2/io/supabase/**` referenziati).

## Verifiche

typecheck, lint completo (0 errori), guard DAL/architettura (bypass = 0),
due esecuzioni Vitest complete consecutive, build di produzione.