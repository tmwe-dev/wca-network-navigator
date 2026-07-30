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

## Batch F20-P0.4 (VERIFIED_FIXED — con DEFERRED su target primario)

### Target primario: P001-018 → **DEFERRED**
- Motivazione: fix richiederebbe import di `Database` generic da `src/integrations/supabase/types.ts` (auto-gen) dentro edge runtime. Cross-boundary vietato dall'architettura (edge non deve dipendere da `src/`). Alternativa (copia schema in `_shared/`) è alto-costo/high-drift.
- Rimandato a batch dedicato che introduca `_shared/db-types.ts` DB-scoped (fuori scope P0).

### Fallback eseguito: **P001-004 VERIFIED_FIXED**
- **Finding**: `src/components/test-extensions/LinkedInTest.tsx` L89-L103 — `runWithCooldown` crea `setInterval` clearato solo dal tick di decremento. Se il componente smonta mid-cooldown, l'interval leak-a (timer vivo + setState su unmounted → warning React).
- **Path/range**: `src/components/test-extensions/LinkedInTest.tsx` L34-L103.
- **File modificati**: 1 runtime (`LinkedInTest.tsx` — +14 righe, −2 righe).
- **Micro-refactor minimo**:
  1. Nuovo `cooldownIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null)`.
  2. `useEffect` cleanup on unmount → `clearInterval(cooldownIntervalRef.current)`.
  3. In `runWithCooldown` finally: clear residuo prima di creare nuovo interval; store in ref; on tick prev≤1 → clear + ref=null.
- **Contratto preservato**: nessuna modifica a firma componente, nessuna dep di `useCallback` (ref stabili non entrano nelle deps), stesso `setRunning(false)` al termine, stessa durata cooldown observable.
- **Prove F20-P0.4**:
  - `tsgo --noEmit`: 0 errors
  - `eslint LinkedInTest.tsx`: 0 warnings / 0 errors
  - `vitest` full suite ×2: 384 files, **3060 pass / 2 skipped / 0 fail** (nessuno skip nuovo)
  - `npm run build`: exit 0
- **Nessun test dedicato**: `runWithCooldown` è closure privata di componente heavy (extensionBridge + optimus + syncGuard). Testarla in isolamento = estrazione = refactor scope-creep vietato dal gate P0. Regressione coperta da suite completa.
- **Δpunteggio prudente**: **+15** (bug concurrency chiuso su componente diagnostico critico).

### Cumulativo P0 finding chiusi: **4 / 33** partition001
P001-007 (DAL bypass) · P001-025 (Levenshtein reimpl) · P001-016 (logging non strutturato) · P001-004 (interval leak).

---

## Batch F20-P0.5 (ESEGUITO)

**Base**: `d6b6770451505ac261c49d6699a005005a88c0a0`. Nessun deploy, nessuna migration.

### 0. Riparazione documentale ledger (pre-requisito del brief)
- Riga P001-004 (P0.4) era **JSONL invalido**: `cumulative_p0_fixed` / `cumulative_findings_closed` erano finiti dentro l'array `tests`. Spostati a campi top-level (`cumulative_p0_fixed` corretto a **4**).
- Campi `commit` allineati ai commit effettivi: P0.3 → `39147d50e92f9c63f750b7378ded5d19739c5eb4`, P0.4 → `d6b6770451505ac261c49d6699a005005a88c0a0` (erano base/`post-P0.3`).
- **Gate**: `JSON.parse` su **tutte** le righe → 15/15 valide (pre-fix 1 invalida). Evidenze sostanziali non alterate.

### 1. Finding trattato: **P001-002 — VERIFIED_FIXED**
- **File**: `src/components/test-extensions/LinkedInTest.tsx` (unico runtime file toccato).
- **Problema provato**: `JSON.parse(raw) as StoredLiTestRecipient` seguito da `saved?.url?.trim()`. Il cast non valida nulla: `"stringa"`, `42`, `[1,2]`, `{"url":123}` sono JSON validi e `.trim()` su non-stringa lancia `TypeError`, mascherato dal `try/catch`.
- **Fix minimo (8 righe)**: parse in `unknown` → early-return se non object / `null` / array → early-return se `typeof candidate.url !== "string"` → `.trim()` su stringa certa.
- **Invarianza**: per payload validi il comportamento è identico (stesso trim, stessa `isValidLinkedInTestUrl`, stessi `setSendUrl`/`setProfileUrl`/`log`). Payload malformato: nessun throw, **state non popolato**. Chiave storage, UX e altri flussi invariati.
- **Gate verde**: `tsgo --noEmit` 0 errori · `eslint` file toccato 0/0 · `npm run build` exit 0 · `vitest` full suite ×2: 384 files, **3060 pass / 2 skipped / 0 fail** (nessun nuovo skip).
- **Nessun test dedicato**: l'effect è inline in un componente da ~690 righe che al mount istanzia extensionBridge/optimus/syncGuard; verificare la guard richiederebbe estrarla in modulo (refactor) o montare il componente con mock pesanti — entrambi oltre il limite "max 1 runtime file" del gate. Prove: diff statico + typecheck strict + suite completa ×2.
- **Rischio residuo**: il `try/catch` esterno resta e continua a mascherare errori imprevisti; non rimosso per non cambiare comportamento osservabile.
- **Δpunteggio prudente**: **+12**.

### Cumulativo P0 finding chiusi: **5 / 33** partition001
P001-007 · P001-025 · P001-016 · P001-004 · P001-002.

---

## Batch F20-P0.6 (ESEGUITO)

### Finding trattato: **P001-013 — VERIFIED_FIXED**
- **File**: `src/data/funnemailInbox.ts` (unico runtime file toccato).
- **Verifica preliminare superata**: tutte e 8 le relazioni usate sono presenti nei types generati.
- **Fix**: 8 call site su tabella letterale migrati da `untypedFrom()` (`any`) al client tipizzato `supabase.from()`. Query, colonne, filtri, ordinamenti e contratti invariati: cambia solo il tipo statico del builder.
- **Non migrati (motivazione inline nel file)**: `untypedFrom(source)` ×2 (sorgente dinamica view|tabella, il client tipizzato non accetta unione di nomi tabella) e 4 query dentro `fetchAllPages<T>` / con `.then()` tipizzato a mano, dove il Row generato diverge dal tipo applicativo (`suggested_action: string` vs union, `funnemail_policy: Json` vs shape). Provato empiricamente: 2 errori TS2322 → rollback mirato di quelle righe.
- **Gate verde**: `tsgo` 0 errori · `eslint` file toccato 0/0 · `npm run build` exit 0 · `vitest` ×2: 384 files, **3060 pass / 2 skipped / 0 fail**.
- **Δpunteggio prudente**: **+14**.

### Cumulativo P0 finding chiusi: **6 / 33** partition001
P001-007 · P001-025 · P001-016 · P001-004 · P001-002 · P001-013.

---

## Batch F20-P0.7 (CANDIDATE)

**Candidato primario**: allineamento tipi applicativi `FunnemailDecisionRow.suggested_action` / `EmailSenderGroupRow.funnemail_policy` ai Row generati, per chiudere i 4 `untypedFrom` residui di `funnemailInbox.ts`. Solo tipi, nessuna migration/RLS/auth/dati.

**Candidato secondario**: prossimo finding di logging non strutturato / guard runtime a basso rischio nella partition001, con lo stesso profilo di P001-016 (max 1 runtime file).

**Esclusi per policy P0**: P001-014/015 e P001-001 (split monoliti → P1), P001-018 (cross-boundary types edge), P001-011 (richiede migration RPC).

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

## Batch F20-P0.6b (base a1272065d52adcff3f48b0ff1278f3904fd6eb08)

### Preflight ledger
Corretti esclusivamente i due campi `commit` delle righe `F20-P0.5` (da `d6b677...` al commit effettivo `a1272065...`). Nessuna riformattazione: tutte le altre righe preservate byte-per-byte. `JSON.parse` valido su 16/16 righe.

### Finding trattato: **P001-013 — VERIFIED_FIXED (residui chiusi)**
- Pre: 6 call site `untypedFrom()` residui in `src/data/funnemailInbox.ts`.
- Post: migrati a `supabase.from()` tipizzato i due su tabella letterale coperta dai tipi generati (`funnemail_sender_intel`, `partners`). Nessun `any` / `unknown as` / `@ts-ignore`, nessun cambio di firme, export, error semantics o ordering.
- Residui documentati (4): 2 su sorgente dinamica `message_intelligence_v | channel_messages`; 2 su `fetchAllPages<T>` con divergenza Row generato vs tipo applicativo (`suggested_action`, `funnemail_policy`).

### Gate
tsgo 0 errori · eslint 0/0 · build exit 0 · test mirati 9 pass · vitest ×2 → 3060 pass / 2 skipped / 0 fail.

### Prossimo batch P0.7
Verificare **P001-027** (`useGroupingData.ts`): il grep non trova più `.from()` diretti → probabile FALSE_POSITIVE da certificare. Fallback: **P001-003** (documentazione ordine di priorità in `resolveThreadTarget`). Esclusi per policy P0: P001-005/014/015/017/019/020/022/026/030 (monoliti), P001-011 (RPC/migration), P001-018 (cross-boundary types).
