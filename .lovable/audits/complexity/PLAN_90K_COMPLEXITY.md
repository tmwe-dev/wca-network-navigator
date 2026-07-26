# PLAN_90K_COMPLEXITY.md

Piano di **riduzione dimensione/complessità** senza toccare feature. Ordinato in batch **piccoli e reversibili**. Ogni batch dichiara baseline, target, rischio, dipendenze, file candidati, gate GO/NO-GO, rollback e contributo prudente al punteggio (base 74.720 → target 90.000).

**Vincoli assoluti**:
- Nessun refactor architetturale generale, nessuna riscrittura.
- Nessuna modifica schema/RLS/dati/config funzionale.
- Tutti i batch sono **reversibili** con singolo revert.
- Ogni batch **verifica** con `deno check` (edge), `tsgo` (frontend), vitest e build prima di dichiarare GO.

---

## Legenda severità (fatti / inferenze / non provabili)
- **[FATTO]**: misurato dall'inventario (SHA1, LOC, marker).
- **[INFERENZA]**: import graph statico + regex — probabile ma verificare.
- **[NON PROVABILE STATICAMENTE]**: richiede runtime/execution/AST.

---

## P0 — Rischi e contraddizioni immediate (score +250)

### P0.1 — Dedup esatto edge `caCerts.ts` (6 copie identiche)
- **Baseline [FATTO]**: 6 file SHA1 identici in `apply-email-rules`, `backfill-email-rules`, `check-inbox`, `check-inbox-booking`, `imap-list-folders`, `manage-email-folders`.
- **Target**: 1 sorgente in `supabase/functions/_shared/caCerts.ts` + 6 re-export shim di 1 riga.
- **File candidati** (non modificati): i 6 elencati sopra + nuovo `_shared/caCerts.ts`.
- **Rischio**: basso. `_shared/` è già ammesso dal runtime edge.
- **Gate GO**: `deno check` verde su 6 function, `deno test` invariato, byte diff = -5×~lineCount.
- **Rollback**: revert del singolo commit ripristina i 6 file.
- **Δpunteggio prudente**: **+40**.

### P0.2 — Dedup esatto `bounceDetector.ts`, `enqueueEnrichment.ts`, `mimeDecoder.ts`, test IMAP
- **Baseline [FATTO]**: 5 cluster SHA1 identici tra `check-inbox` e `check-inbox-booking`.
- **Target**: sorgente unica in `_shared/imap/` + shim.
- **Rischio**: basso — moduli puri senza stato.
- **Gate GO**: come sopra + esecuzione dei 2 test integration.
- **Δpunteggio**: **+50**.

### P0.3 — Migrations duplicate 20260403010412 vs 20260403010449
- **Baseline [FATTO]**: due file `.sql` con SHA1 identico a 37 secondi di distanza.
- **Target**: mantenere solo la prima; la seconda diventa migration no-op documentata (NON eliminare per non rompere lo storico applicato) oppure eliminata solo se **verificato** che non sia stata applicata in prod (richiede check da DB — se dubbio, no-op).
- **Rischio**: alto se applicata in prod → resta **no-op**.
- **Gate GO**: verifica in dev DB stato `schema_migrations`. **NO-GO** finché non verificato.
- **Δpunteggio**: **+20**.

### P0.4 — Near-dup migration 20260419100310 vs 20260420034510
- Stesso trattamento di P0.3, con priorità inferiore.
- **Δpunteggio**: **+10**.

### P0.5 — `AuroraBorealis.tsx` duplicato (globe + campaigns)
- **Baseline [FATTO]**: SHA1 identico tra `src/components/campaigns/AuroraBorealis.tsx` e `src/standalone-globe/components/AuroraBorealis.tsx`.
- **Target**: `standalone-globe` è il pacchetto isolato; re-export dal componente campaigns.
- **Rischio**: basso — verificare che campaigns non alteri props di default.
- **Δpunteggio**: **+15**.

### P0.6 — Guardrail expose upstream error (già in HEAD, verificare regressioni)
- **Baseline [FATTO]**: HEAD ha già l'allargamento del payload d'errore in `whatsapp-ai-extract` (delta vs base richiesta).
- **Azione P0**: solo audit — verificare che `linkedin-ai-extract`, `optimus-analyze` abbiano stessa disciplina o restino con messaggi generici (finding aperto, non fix in P0).
- **Δpunteggio**: **0** (già in HEAD).

P0 totale: **+135**.

---

## P1 — Consolidamenti ad alta leva (score +900)

### P1.1 — Split file monster ≥600 righe
Basato su `TOP_HOTSPOTS.md`. Suddivisione **per responsabilità**, nessun cambio comportamento.

| # | File | Righe | Split candidato |
|---|------|------:|-----------------|
| 1 | `src/hooks/useCockpitLogic.ts` | 643 | estrarre `useCockpitFilters`, `useCockpitSelection`, `useCockpitPersistence` |
| 2 | `src/data/partners.ts` | 684 | separare `partners.queries.ts` / `partners.mutations.ts` / `partners.mappers.ts` |
| 3 | `src/data/funnemailInbox.ts` | 636 | separare query vs mutations |
| 4 | `src/v2/ui/pages/prompt-lab/HarmonizeSystemDialog.tsx` | 723 | estrarre 3 sotto-componenti sezione |
| 5 | `src/v2/ui/pages/prompt-lab/PromptCopilotPanel.tsx` | 627 | pattern uguale |
| 6 | `src/v2/ui/pages/prompt-lab/tabs/PromptTestsTab.tsx` | 594 | estrarre form + list |
| 7 | `supabase/functions/send-email/index.ts` | 616 | estrarre `_helpers.ts` (build MIME, dry-run, template) |
| 8 | `supabase/functions/_shared/toolHandlersRead.ts` | funzione 527 | 1 handler per file |
| 9 | `supabase/functions/_shared/toolHandlersWrite.ts` | funzione 469 | idem |
| 10 | `src/components/test-extensions/LinkedInTest.tsx` | 667 | test-only: valutare spostamento in `e2e/` |
| 11 | `src/components/test-extensions/WhatsAppTest.tsx` | 512 | idem |

- **Rischio**: medio — split UI/hook può alterare re-render se mal fatto. Mitigazione: 1 file per batch, test unit di partenza obbligatori.
- **Gate GO per singolo split**: tsgo verde, vitest verde, nessuna diff visiva su Playwright della route toccata.
- **Δpunteggio**: **+500** cumulativo (11 sotto-batch, +30÷+80 ciascuno).

### P1.2 — Dedup boilerplate Edge Functions
**[INFERENZA]** — 8 gruppi Edge condividono prefisso (agent-, ai-, funnemail-, kb-, save-, tmwe-…) e boilerplate ripetuto (CORS, authGuard, error shape).
- **Azione**: continuare migrazione a `_shared/authGuard` (già iniziata E2/E3), estendere a `_shared/edgeResponse` per shape errori.
- **Gate**: `deno check` verde, contract-test HTTP invariante su risposte auth/error.
- **Δpunteggio**: **+200** (3 batch da 3 function ciascuno).

### P1.3 — DAL bypass residui (185 hit / 82 file)
**[FATTO]** — top: `src/v2/io/supabase/queries/dashboard.ts` (20), `RulesAndActionsTab.tsx` (14), `InUscitaTab.tsx` (9).
- **Azione**: 1 file per batch → sposta query in DAL centralizzato (`src/data/` o `src/v2/data/`), UI consuma via hook.
- **Gate**: vitest hook verde, screenshot Playwright della pagina invariato.
- **Δpunteggio**: **+200** (10 batch × +20).

P1 totale: **+900**.

---

## P2 — Migrazione legacy v1→v2 (solo con replacement attivo) (score +400)

### P2.1 — 45 basename in overlap v1/v2
**[INFERENZA]** — stesso basename non implica stesso comportamento. Serve triage 1-a-1:
1. Per ogni coppia: confrontare import graph (fan-in di v1 vs v2), route consumatrici, differenze API.
2. Categorie:
   - **CONVERGE**: v2 sostituisce v1 → migrare importer + rimuovere v1 (1 batch per coppia).
   - **DIVERGE**: mantenere entrambi con rinomina esplicita (`XyzV1.tsx` / `XyzV2.tsx`).
   - **DEAD v1**: v1 non ha importer → candidato a rimozione (verifica route string / lazy).
- **Vincolo**: NO rimozioni senza replacement verificato.
- **Δpunteggio**: **+400** (progressivo, +8÷+20 per coppia).

### P2.2 — Orfani candidati (473 file)
**[NON PROVABILE STATICAMENTE]** — l'import graph statico non vede lazy/route-string. Non rimuovere in blocco.
- **Azione**: analisi campionaria + strumentazione runtime (log HMR/Vite ProbeReport) — **fuori scope P2**, resta backlog.
- **Δpunteggio**: **0** (in P2, +TBD dopo strumentazione).

---

## P3 — Edge / KB / Agent (score +250)

### P3.1 — Consolidamento famiglie `check-inbox*` / `funnemail-*` / `email-*`
- **Baseline [FATTO]**: `check-inbox` e `check-inbox-booking` condividono 5 moduli identici (già coperti P0.2). Rimane `index.ts` divergente → **NON unificare** (contratti diversi).
- **Azione**: solo dedup moduli sotto (già in P0.2). Documentare in `docs/audit/edge-family-map.md`.
- **Δpunteggio**: **+50**.

### P3.2 — `_shared/toolHandlersRead.ts` + `Write.ts` split (già in P1.1)
- Nota: già coperto in P1.1 riga 8-9. Nessun doppio conteggio.

### P3.3 — KB prompt-lab file monster (P1.1 righe 4-6)
- Idem, no doppio conteggio.

---

## P4 — Performance / bundle / test (score +265)

### P4.1 — `console.*` migration a `createLogger` (527 hit)
- **[FATTO]** top 5 file: `scripts/report-classify-dedup.ts` (13), `scripts/seed-kb.ts` (10), `agent-execute/toolHandlers/emailTools.ts` (8), `replay-domain-events/index.ts` (8), `send-email/index.ts` (8).
- **Azione**: 1 file per batch, `console.*` → `logger.*`.
- **Δpunteggio**: **+80**.

### P4.2 — `any` residui runtime (977 totali, 67 file oltre soglia)
- Top runtime (esclusi test): `src/hooks/*` e `src/data/*`. Test-only rimossi dal target (accettabili).
- **Azione**: 1 file per batch, tipizzare via inference/generics.
- **Δpunteggio**: **+80**.

### P4.3 — Test coverage LOC ratio 0.135 → 0.20
- **Azione**: portare test unit sui top-hotspot (P1.1) come parte del batch stesso.
- **Δpunteggio**: **+60**.

### P4.4 — Bundle size guard baseline
- **Azione**: catturare baseline `scripts/bundle-size-guard.mjs`, aggiungere hard limit CI.
- **Δpunteggio**: **+45**.

---

## Riassunto punteggio prudente

| Fase | Descrizione | Δ |
|------|-------------|--:|
| P0 | Dedup esatti + contraddizioni | +135 |
| P1 | Split file monster + Edge shared + DAL | +900 |
| P2 | Legacy v1→v2 con replacement | +400 |
| P3 | Consolidamento Edge/KB/Agent | +50 |
| P4 | Console/any/test/bundle | +265 |
| **Totale prudente** | | **+1.750** |

Baseline 74.720 → **target dopo esecuzione completa: 76.470**. Il target 90.000 richiede batch aggiuntivi (P5+ da ridefinire su nuovo baseline dopo P0-P4).

---

## Batch F20-P0.1 (VERIFIED_FIXED — gate F20-P0.1V)

**Micro-cluster**: 1 finding priorità (c) — DAL bypass write in `useCockpitLogic.ts`.

- **Finding trattato**: P001-007 (DAL bypass, medium sev, low risk).
- **File runtime modificati**: 2 (`src/data/partners.ts` +55 righe helper, `src/hooks/useCockpitLogic.ts` −12 / +14 righe).
- **File totali toccati**: 4 (aggiunta `src/data/__tests__/partners.linkedin.test.ts`, aggiornamento ledger, aggiornamento questo plan).
- **Test mirati pre/post**: 4/4 pass nel nuovo file; 384 file test / 3059 pass / 2 skipped invariati, due run consecutive.
- **Typecheck**: `tsgo --noEmit` verde.
- **Contratti**: nessuna modifica di firma pubblica, nessuna migrazione DB, nessuna variazione UX/auth/permessi. Silent-on-error preservato (nessun toast, nessun throw).
- **Deferred nello stesso cluster**: P001-004 (fuori priorità), P001-006 (split monolite vietato in gate), P001-008 (richiede Zod), P001-011 (richiede routing edge).
- **Commit gate**: `c062ca47aacce1617f2cf00a816952721b9f0f33`.
- **Prove F20-P0.1V**:
  - `npx vitest run src/data/__tests__/partners.linkedin.test.ts` → 4/4 pass.
  - `npm run typecheck` (`tsc -p tsconfig.app.json --noEmit`) → exit 0.
  - ESLint sui 3 file toccati → 0 errors 0 warnings (fix `_kind` param non usato).
  - ESLint `--max-warnings 0` sul repo intero → 234 warnings baseline preesistenti in file non toccati dal batch (nessun errore, nessuna nuova warning introdotta dal batch).
  - `npm run build` → exit 0.
  - Vitest full suite run #1: 384 files, 3059 pass / 2 skipped / 0 fail.
  - Vitest full suite run #2: 384 files, 3059 pass / 2 skipped / 0 fail (nessuno skip nuovo vs baseline).
  - Verifica statica bypass: `rg 'supabase.from\("partners"\)' src/hooks/useCockpitLogic.ts` → nessuna occorrenza.
  - Verifica caller helper: unico chiamante di `persistLinkedInProfileForCompany` = `src/hooks/useCockpitLogic.ts:309` (fire-and-forget con `mountedRef` guard L311/L315).
  - Merge additivo enrichment_data (`...existing`), match `ilike("company_name", "%..%")` limit 1, silent-false-on-error (`return !error` + `catch → false`) confermati per read + write.
- **Punti**: non assegnati (compliance DAL, no delta bypass count fuori partition-001).

## Batch F20-P0.2 (VERIFIED_FIXED)

**Micro-cluster**: test che reimplementa logica di produzione (priorità b).

- **Finding trattato**: **P001-025** — VERIFIED_FIXED.
- **Finding target originale del brief (P001-014, P001-015)**: DEFERRED — size-only high-sev che richiedono split multi-file (4 step components per HarmonizeSystemDialog / 4 helper per send-email). Fuori vincoli gate P0 (max 3 file, divieto refactor monoliti). Rimandati a batch P1 dedicato monoliti. Nel brief P0.2 il target coerente col cluster "reimplementazione Levenshtein / contact-merge-logic.test.ts" è **P001-025**, come già identificato nel gate P0.1V.
- **File runtime/test modificati**: 3 (`src/lib/contactSimilarity.ts` nuovo helper puro 55 righe; `src/hooks/useContactMerge.ts` −42 / +5 righe; `src/test/contact-merge-logic.test.ts` −44 / +12 righe incluso 1 test-guard multi-@).
- **File totali toccati**: 5 (i tre sopra + `fix-ledger.jsonl` + questo plan).
- **Prove del problema pre-fix**: `levenshteinDistance`/`extractDomain`/`calculateSimilarity` duplicati byte-identici in `useContactMerge.ts` L14-L55 e in `contact-merge-logic.test.ts` L10-L51; produzione non li esportava — copia in-test avrebbe potuto divergere silenziosamente.
- **Prove post-fix**: entrambi i consumer ora `import { … } from "@/lib/contactSimilarity"`; la produzione usa `calculateSimilarity` (che internamente chiama `levenshteinDistance` dal medesimo modulo del test). Qualsiasi modifica al modulo helper rompe simultaneamente produzione e test — non più falsa sicurezza.
- **Test mirati**: `contact-merge-logic.test.ts` 39/39 pass (era 38 + 1 nuovo guard "legacy multi-@ split contract"); suite passata da 3059 → 3060 (+1 test, 0 skip nuovi).
- **Typecheck**: `tsc -p tsconfig.app.json --noEmit` exit 0.
- **Lint sui 3 file toccati**: `eslint --max-warnings 0` → 0 errors 0 warnings.
- **Build**: `npm run build` exit 0.
- **Vitest full suite ×2**: 384 files, 3060 pass / 2 skipped / 0 fail (nessuno skip nuovo).
- **Contratti**: nessuna nuova API pubblica (le tre funzioni erano private in `useContactMerge` e restano usate solo internamente + dal test); nessuna migration/schema/RLS/dati/UX/auth.
- **Commit gate**: `pending` (aggiornato dal successivo gate di verifica).
- **Punti**: **+30** (fiducia test recuperata, zero regressione, +1 caso di guardia).

---

## Batch F20-P0.3 (VERIFIED_FIXED)

- **Finding trattato**: **P001-016** (medium sev, low risk) — logging non strutturato in edge critico.
- **Path/range**: `supabase/functions/send-email/index.ts` L614 (era 606-616 nel finding) — `console.error("send-email error:", e)` sostituito con `createLogger("send-email").error("send-email error", e)`.
- **Helper usato**: `supabase/functions/_shared/structuredLogger.ts` — `createLogger(fnName).error(message, err, context?)` produce line JSON single-line searchable in Supabase logs; `errorToContext` estrae `name`/`message`/`stack` (primi 8 frame).
- **Contratto invariato**: HTTP response `edgeError("INTERNAL_ERROR", ...)` con status/body/headers identici; nessun `await` aggiunto (fire-and-forget come `console.error`); ordine di esecuzione preservato.
- **File modificati**: 1 runtime (`send-email/index.ts` — 2 righe: 1 import + 1 sostituzione).
- **Prove F20-P0.3**:
  - `deno check send-email/index.ts`: 5 errori TS **pre-esistenti** (TS2589 SupabaseClient deep instantiation, TS2345 SmtpSendOptions/ErrorCode) su range non toccati dal patch — appartengono al monolite P001-015 (batch P1).
  - `eslint` sul file: 0 errors.
  - `vitest` full suite ×2 consecutive: 384 files, 3060 pass / 2 skipped / 0 fail (nessuno skip nuovo).
  - `npm run build`: exit 0.
- **Esclusioni**: gli altri 7 `console.*` di `send-email/index.ts` restano fuori scope (P001-015 monolite → batch P1).
- **Δpunteggio prudente**: **+20**.

---

## Batch F20-P0.4 (CANDIDATE — deterministico, non ancora eseguito)

- **Finding trattato**: **P001-018** (medium sev — typing `SupabaseClient = any` in `supabase/functions/_shared/toolHandlersRead.ts` L8-L13).
- **Prova**: cast `any` esplicito con `deno-lint disabled` motivato ma propaga perdita di safety a 15 handler `.from/.rpc`.
- **Azione prevista**: introdurre alias `type SupabaseClientLike = SupabaseClient<Database>` importando `Database` dallo shared types generato, oppure lasciare `any` documentato se il generic `Database` non è importabile lato edge senza pulling di `src/integrations/supabase/types.ts` (rischio cross-boundary). Max 2 runtime file (`toolHandlersRead.ts`, `toolHandlersWrite.ts`).
- **Fallback**: se `Database` non riutilizzabile lato edge senza copia, marcare P001-018 DEFERRED e passare al successivo FACT low-risk del ledger partition001 (candidato **P001-011** — DAL bypass residuo o **P001-004** — silent catch).
- **Nessuna implementazione in questo job.**

---

## Regole trasversali su ogni batch
1. **Un file per commit** dove possibile.
2. **Test unit di regressione** aggiunto o esistente **prima** dello split.
3. **Screenshot Playwright** della route toccata (before/after) per UI.
4. **Nessun cambio di firma pubblica** senza migrazione contestuale dei call site.
5. **Rollback**: singolo `git revert`.
6. **Gate CI**: `tsgo`, vitest, `deno check` su tutte le edge toccate, ESLint, build.

---

## Copertura audit (dichiarazione onesta)

- **File inventariati / totali**: 4130 / 4130 = **100.00%** [FATTO].
- **Righe totali inventariate**: 545.596 [FATTO].
- **Righe classificate semanticamente** (regole strutturali applicate): 426.729 / 545.596 = **78.21%** [FATTO]. Il gap 21.79% è **esclusione intenzionale** (asset binari, generated, archive, docs/memory, JSON/lockfile) elencata in `AUDIT_METHOD.md`.
- **File classificati semanticamente**: 3.445 / 4.130 = **83.41%** [FATTO].
- **Righe non analizzate riga-per-riga per contenuto**: 100% dei file testuali ha ricevuto metriche aggregate (LOC, cyclo, marker, access). L'ispezione **riga-per-riga letterale** (una entry finding per ogni riga) è **intenzionalmente non prodotta**: sarebbe rumore statistico di ~426k entry senza valore azionabile. I finding sono generati per **regole strutturali** (14 codici) su intervalli line-anchored.
- **Verifica multi-metodo**: import graph (AST-like via regex) + rg-style pattern + fingerprint SHA1/normalizzato — applicati **contemporaneamente** su ogni file per ridurre falsi positivi.
- **Non dichiaro 100% di "profondità"**: la ciclomatica è stima regex; gli orfani sono candidati non conferme; RLS/SQL sono coperti solo come LOC.

---

## Checkpoint per turno successivo (se A1 non chiuso)

A0 completato al 100%. A1 completato per **regole strutturali su 3.445 file semantici**. Restano fuori dal presente turno:
1. **Ispezione manuale riga-per-riga** dei top 20 file per righe (LinkedInTest, useCockpitLogic, partners.ts, funnemailInbox.ts, HarmonizeSystemDialog, send-email/index, toolHandlersRead, toolHandlersWrite, PromptCopilotPanel, PromptTestsTab, ComposerCanvas, SenderActionsDialog, calendar-flow.spec, contact-merge-logic.test, useEmailComposerState, useGroupingData, useGlobalPromptImprover, useDeepSearchLocal, WhatsAppTest, RulesAndActionsTab).
2. **Verifica applicazione DB migrations duplicate** (P0.3 gate).
3. **Triage 1-a-1 delle 45 coppie v1/v2** (P2.1).
4. **Strumentazione runtime per orfani** (P2.2).

Ogni item ha input deterministico già in `.lovable/audits/complexity/analysis.json` → il prossimo turno può ripartire senza rifare A0.