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

## Batch F20-P0.6 + P0.6b (ESEGUITI — sezione consolidata)

### Finding trattato: **P001-013 — VERIFIED_FIXED**
- **File runtime**: `src/data/funnemailInbox.ts` (unico file runtime toccato nei due sotto-batch).
- **Totale migrato**: **10 call site** da `untypedFrom()` (`any`) al client tipizzato `supabase.from()` — 8 in P0.6, 2 in P0.6b (`funnemail_sender_intel`, `partners`). Query, colonne, filtri, ordinamenti, firme, export ed error semantics invariati: cambia solo il tipo statico del builder.
- **Residui motivati (4)**: 2 su sorgente dinamica `message_intelligence_v | channel_messages` (il client tipizzato non accetta un'unione di nomi tabella); 2 dentro `fetchAllPages<T>` dove il Row generato diverge dal tipo applicativo (`suggested_action: string` vs union, `funnemail_policy: Json` vs shape). Provato empiricamente: 2 errori TS2322 → rollback mirato. Motivazione documentata inline nel file.
- **Gate reali**: `tsgo` 0 errori · `eslint` file toccato 0/0 · build exit 0 · test mirati 9 pass · `vitest` ×2: 384 files, **3060 pass / 2 skipped / 0 fail** (nessun nuovo skip).
- **Ledger**: righe F20-P0.6 / F20-P0.6b allineate al commit effettivo `d79ecd00b4711cf3ce644058d3ff4373dd2234c7`.

### Cumulativo P0 finding chiusi: **6 / 33** partition001
P001-007 · P001-025 · P001-016 · P001-004 · P001-002 · P001-013.

### Prossimo candidato unico: **P001-027**

---

## Batch F20-P0.7 (ESEGUITO)

### Finding trattato: **P001-027 — CONFIRMED_FACT / DEFERRED (nessun runtime edit)**
- **Rettifica dell'evidenza originale**: il finding dichiarava «0 `.from()` diretti». **Falso**. La verifica sul file attuale `src/components/email-intelligence/manual-grouping/useGroupingData.ts` (447 righe) mostra `import { supabase } from "@/integrations/supabase/client"` e accessi diretti multipli. **Conteggio rettificato in P0.8** (il precedente «12 accessi / 10 `.from()`» era errato e incoerente col dettaglio elencato). Conteggio reale su file, per categoria:
  - **11 query DAL `supabase.from()`** — righe 58, 80, 104, 123, 132, 157, 232, 294, 329, 362, 385 su `email_sender_groups`, `email_address_rules`, `channel_messages` (escluse le 2 occorrenze di `Array.from` alle righe 186 e 251, non-Supabase);
  - **3 chiamate auth `supabase.auth.getSession()`** — righe 55, 99, 286;
  - **1 apertura canale realtime `supabase.channel()`** — riga 414;
  - **1 rimozione canale `supabase.removeChannel()`** — riga 422.
  - **Totale: 16 accessi diretti al client Supabase.** Nessun alias/wrapper (`untypedFrom`, `tFrom`, `rpc`, `functions.invoke`, `fetch`) presente. Coerente con P001-033 che elenca `useGroupingData` tra i DAL bypass.
- **Quindi NON è un falso positivo**: il bypass DAL esiste.
- **Perché DEFERRED e non corretto qui**: la correzione richiede un nuovo modulo DAL (`src/data/emailGrouping.ts`) + riscrittura del hook = **2 runtime file**, che sommati a ledger e plan superano il tetto di **3 file totali** del batch. Inoltre coinvolge query condizionali dinamiche e una subscription realtime: fuori dal profilo micro-cluster P0 a rischio nullo.
- **Esito**: DEFERRED (status invariato) → **P1.3 (DAL bypass residui)**, con perimetro già definito (16 accessi: 11 query + 3 auth + 1 channel + 1 removeChannel, 3 tabelle, 1 canale realtime, 3 caller noti).
- **Nessun file runtime modificato in questo batch.**

---

## Batch F20-P0.8 (ESEGUITO)

### Finding trattato: **P001-008 — CONFIRMED_FACT / VERIFIED_FIXED**
- **Conferma del finding (non assunto)**: il contratto `CockpitAIAction` (`src/components/cockpit/TopCommandBar.tsx:12-23`) dichiara `field?: string` **opzionale**; il producer unico è `useIntelliFlowOverlay.ts:108` che fa `const actions = (data?.actions as unknown[]) || []` sul payload di una edge function e lo passa a `executeAIActions` **senza schema né validazione runtime**. Quindi `field` può essere `undefined`, `null`, numero o oggetto: il `field!` a `useCockpitLogic.ts:162` era una bugia di tipo.
- **Impatto reale**: con `field` undefined l'indicizzazione usava la chiave letterale `"undefined"` e, con `operator === "=="` e `value` undefined, il predicato risultava **vero per tutti i contatti** → selezione di massa involontaria a monte delle bulk action.
- **Fix minimo applicato**: la closure esistente è stata estratta in funzione pura esportata `buildSelectWherePredicate(field: unknown, operator: unknown, value: unknown)` **nello stesso file** (nessun nuovo modulo runtime, nessuna modifica all'oggetto ritornato dall'hook). Guard: `typeof field !== "string" || field.length === 0` → `null`; nel `case "select_where"` un predicato `null` produce `log.debug` + `break`, cioè la **stessa semantica di skip silenzioso** già usata da `case "filter"` (`if (action.filters)`) e `case "view_mode"` (`if (action.mode)`). Nessuna nuova UX/toast.
- **Invarianti**: action valide identiche bit-per-bit (stessi 3 operatori, stesso ordine, stesso fallback `false`), contratti action, ordine di esecuzione, query, auth e dati invariati. Nessun `any`, nessun nuovo `unknown as` (l'unico cast è quello preesistente, spostato invariato), nessun `field!`, nessun `@ts-ignore`.
- **Test**: `src/hooks/__tests__/useCockpitLogic.selectWhere.test.ts` (3 test) copre field valido (`>=`, `==`, `includes`), field mancante/non valido (`undefined`, `null`, `""`, `42`, oggetto) e operatore sconosciuto.
- **Gate**: tsgo 0 errori · eslint delta 0 · build exit 0 · 2 suite complete consecutive 385 file / **3063 pass / 2 skipped / 0 fail** (baseline 3060 + 3 nuovi, nessun nuovo skip).

### Verifica idempotenza (F20-P0.8V)

Alla richiesta di riesecuzione del batch su base `42bbf5c3d54c336bc7b790c98b942a382e655203` è stato eseguito il **controllo anti-duplicazione prima di ogni edit**: guard `buildSelectWherePredicate` già presente (definizione riga 27, uso riga 185), **zero occorrenze residue di `field!`**, test file già presente, righe ledger F20-P0.7/F20-P0.8 già allineate al commit corretto, sezione «Batch F20-P0.8 (ESEGUITO)» presente **una sola volta**. **Nessun edit riapplicato.** Gate rieseguiti integralmente e verdi: tsgo 0 errori · eslint delta 0 · build exit 0 · test mirato 3 pass · 2 suite complete consecutive 385 file / 3063 pass / 2 skipped / 0 fail.

### Chiusura P0

**P0 chiuso**: non restano micro-fix runtime sicuri in partition001 entro il profilo del gate. I FACT residui richiedono tutti interventi strutturali → **P1**:
- P001-027 (bypass DAL `useGroupingData`) → nuovo modulo `src/data/emailGrouping.ts` + riscrittura hook → **P1.3**;
- residui untyped in `src/data/funnemailInbox.ts` → richiedono allineare i tipi applicativi (`suggested_action`, `funnemail_policy`) → **P1**;
- P001-024 (615 righe `e2e/calendar-flow.spec.ts`, selettori CSS fragili) → sostituzione con `data-testid` + split in 3 spec → **P1**;
- P001-009/010/012/021/023/028/029/031 (categoria `size`) → split monoliti, vietato dal gate P0 → **P1**;
- P001-003 (ordine priorità `resolveThreadTarget`) → puramente documentale, nessun beneficio runtime.

### Batch F20-P0.9 (CANDIDATE — ultimo micro-batch, rischio zero)

**Candidato unico**: **P001-003** — JSDoc sull'ordine di priorità di `resolveThreadTarget` (`src/components/test-extensions/LinkedInTest.tsx:82-87`, `kind=inference`, `severity=info`). Intervento **solo documentale**: nessuna riga eseguibile toccata, nessun cambio di comportamento, 1 runtime file. È l'unico residuo di partition001 sotto il profilo di rischio P0; tutto il resto è strutturale → P1.

**Esclusi per policy P0**: P001-001/005/014/015/017/019/020/022/026/030 (split monoliti → P1), P001-011 (migration RPC), P001-018 (cross-boundary types edge), P001-003 (documentale, nessun beneficio runtime), P001-027 (deferito a P1.3).

---

### Batch F20-P1.3A (ESEGUITO — avvio fase strutturale DAL)

**Base**: `1585524fdb4a63563c22cda1b15ed7008532f49c`. **Finding**: P001-027 → `PARTIALLY_FIXED`. P0.9 documentale **non** eseguito su richiesta.

**Classificazione integrale delle 11 query `supabase.from()` di `useGroupingData.ts`**

| # | Funzione | Tabella | Tipo | Dettaglio |
|---|---|---|---|---|
| 1 | `loadGroups` | email_sender_groups | READ | `select *`, order `sort_order` asc, error ignorato |
| 2 | `loadAssignedRules` | email_address_rules | READ | 7 col, `not group_name is null`, order `created_at` desc, range paginato 1000, throw |
| 3 | `loadData` | email_sender_groups | READ | identica a #1 |
| 4 | `loadData` | email_sender_groups | WRITE | `upsert` onConflict `nome_gruppo`, ignoreDuplicates, `.select()` |
| 5 | `loadData` (fallback) | email_sender_groups | READ | identica a #1 |
| 6 | `loadData` | email_address_rules | READ | uncategorized: `is group_id null` + `is group_name null`, order `email_count` desc, range |
| 7 | `loadData` | email_address_rules | READ | classified: `or(group_id.not.is.null,group_name.not.is.null)`, order `email_count` desc, range |
| 8 | `populateAddressRules` | channel_messages | READ dinamico | filtri condizionali su `activeMailbox` (personal/shared) |
| 9 | `populateAddressRules` | email_address_rules | READ | `id,email_address,email_count`, order `id` asc, range |
| 10 | `populateAddressRules` | email_address_rules | WRITE | `update email_count` eq id (batch 20) |
| 11 | `populateAddressRules` | email_address_rules | WRITE | `upsert` onConflict `user_id,email_address` (batch 100) |

**Cluster estratto (4 query READ-ONLY)** → nuovo modulo `src/data/emailGrouping.ts`:
- `fetchSenderGroupsOrdered()` ← query #1, #3, #5 (tre letture identiche unificate);
- `fetchAssignedAddressRules()` ← query #2 (con paginazione a 1000 interna al DAL).

**Invarianti preservate**: colonne, filtri, order, range/paginazione, semantica errori (groups: error ignorato → `[]`; assigned rules: throw), shape restituita. **Non spostati**: auth (`getSession`), realtime (`channel`/`removeChannel`), write, stato React, dedup, filtro allowlist mailbox, costruzione `assignedByGroup`. Sequencing `loadData`/`loadGroups`/`loadAssignedRules` e blocchi `try/catch/finally` invariati; API pubblica del hook invariata → caller (`ManualGroupingTab.tsx` e sotto-componenti) non toccati.

**Prova diff**: `.from()` diretti nel hook **11 → 7** (esattamente −4, righe residue 99/129/204/266/301/334/357). Zero `untypedFrom`, `as any`, `@ts-ignore` nei file toccati → nessun bypass equivalente introdotto.

**Gate**: 5 test mirati pass; `tsgo` 0 errori; eslint file toccati 0 errori (1 warning preesistente di pattern `no-restricted-imports`, già presente in 4 file sorelle della cartella); build exit 0; due suite complete consecutive **386 file, 3068 pass / 2 skipped / 0 fail** (baseline 3063 + 5 nuovi, nessun nuovo skip).

### Batch F20-P1.3B (ESEGUITO)

**Base**: `8df125a0b1d4ea902095ad265b1b49c3444b51cd`. **Finding**: P001-027 → resta `PARTIALLY_FIXED`.

Secondo micro-cluster READ-ONLY di `useGroupingData`: query #6 e #7 estratte in `src/data/emailGrouping.ts` come `fetchUncategorizedAddressRules()` e `fetchClassifiedAddressRules()`, con i tipi riga `UncategorizedAddressRuleRow` e `ClassifiedAddressRuleRow` (extends).

**Equivalenza provata**: #6 → stesso select 11 colonne, `is group_id null` + `is group_name null`, order `email_count` desc, range paginato 1000, throw su errore; #7 → stesso select + `group_id, group_name`, `or(group_id.not.is.null,group_name.not.is.null)`, order `email_count` desc, range paginato, throw.

**Restano nel hook** (non toccati): dedup con somma `_summed` e id canonico, mapping `SenderAnalysis`, filtro allowlist mailbox, `setSenders`/`setClassifiedSenders`, ordine sequenziale degli await, `try/catch/finally` con toast e `setIsLoading`. Nessuna auth/realtime/write/schema/RLS/UX.

**Prova diff**: `.from()` diretti nel hook **7 → 5** esatti (residui: 104 upsert `email_sender_groups`, 228 `channel_messages`, 263/296/319 `email_address_rules`). Zero `untypedFrom`/`as any`/`@ts-ignore`; API pubblica del hook invariata → caller non modificati.

**Gate**: 10 test DAL pass (5 nuovi); `tsgo` 0 errori; eslint delta 0 errori (1 warning preesistente invariato); build exit 0; due suite complete **386 file, 3073 pass / 2 skipped / 0 fail** (baseline 3068 + 5, nessun nuovo skip).

### Batch F20-P1.3C (ESEGUITO)

**Base**: `8df125a0b1d4ea902095ad265b1b49c3444b51cd`. **Finding**: P001-027 → resta `PARTIALLY_FIXED`.

**Query READ dinamica #8** (`channel_messages` in `populateAddressRules`) estratta in `src/data/emailGrouping.ts` come `fetchInboundEmailSenderAddresses({ userId, mailbox })`. Nuovo tipo discriminato `MailboxFilter = { kind: "personal" } | { kind: "shared"; mailboxId: string }`, più `null` quando la mailbox attiva non è ancora risolta: i tre casi corrispondono esattamente ai rami già presenti nel hook, nessun comportamento inventato.

**Equivalenza provata**: stesso `select("from_address")`, stessi `.eq("channel","email")` / `.eq("direction","inbound")` / `.eq("user_id", user.id)`, stesso `.not("from_address","is",null)`, stesso `.order("id", { ascending: true })`, stessa paginazione `.range` a 1000 (helper `fetchAllRows` del DAL identico a quello locale), stessa semantica errori (throw). Personal → `.is("mailbox_id", null)`; shared → `.eq("mailbox_id", id)`; nessuna mailbox → nessun filtro.

**Restano nel hook**: `supabase.auth.getSession()` (auth non spostata, `userId` passato esplicitamente), conteggio per indirizzo, normalizzazione lowercase/trim con skip senza `@`, dedup, batching update 20 / upsert 100, toast, invalidazioni query, ordine di esecuzione. Write #4/#10/#11, realtime, stato React, UX, schema/RLS/dati non toccati.

**Prova diff**: `.from()` diretti nel hook **5 → 4** esatti (residui: 106 upsert `email_sender_groups`, 255/288/311 `email_address_rules`; le occorrenze `Array.from` a 144/187 non sono query). Zero `untypedFrom`/`as any`/`@ts-ignore`; API hook e caller invariati.

**Gate**: 15 test DAL pass (5 nuovi); `tsgo` 0 errori; eslint delta 0 errori (1 warning preesistente invariato); build exit 0; due suite complete **386 file, 3078 pass / 2 skipped / 0 fail** (baseline 3073 + 5, nessun nuovo skip).

**Verifica idempotenza (F20-P1.3CV)**: controllo anti-duplicazione su richiesta di riesecuzione — `fetchInboundEmailSenderAddresses`/`MailboxFilter` presenti una sola volta nel DAL, un solo punto di uso nel hook, un solo blocco test, una sola riga ledger e una sola sezione plan. Nessun edit riapplicato. Gate rieseguiti integralmente: 15 test DAL, `tsgo` 0 errori, eslint delta 0 errori, build exit 0, due suite complete 386 file / 3078 pass / 2 skipped / 0 fail.

### Batch F20-P1.3D (PREPARATO)

Prima **write** estratta, scelta come la più sicura: **#10 update `email_count`** (`update({ email_count }).eq("id", id)`) → `updateAddressRuleEmailCount(id, count)` nel DAL, lasciando nel hook il batching a 20 e il `Promise.all`. Preferita a #4 (upsert gruppi con `onConflict: nome_gruppo` + `ignoreDuplicates` + `select` e fallback re-read) e a #11 (upsert batch con `onConflict: user_id,email_address`) perché ha superficie minima, nessun conflict target e nessuna shape di ritorno consumata. Atteso `.from()` **4 → 3**.

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
