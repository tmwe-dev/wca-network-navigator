CLASSE: CRITICAL — OBIETTIVO: applicare la roadmap dell'audit Funnemail (00-EXECUTIVE-SUMMARY.md) seguendo Quick Codex, senza toccare nodi intoccabili (`check-inbox`, `email-imap-proxy`, `mark-imap-seen`) e senza bypassare `journalistReview` o l'AI Invocation Charter.

## Decisioni bloccanti prima di partire

Due item della roadmap **non posso eseguirli senza tua scelta esplicita**. Ti chiedo di confermare in chat prima dell'implementazione:

1. **C1 / G4 — Autoresponder "presa in carico"** (conflitto spec docx vs `editorial-review-layer-mandatory`). Tre opzioni:
   - **(a) Sospendere** il requisito spec → niente autoresponder, marker UI "ricevuto" e basta.
   - **(b) Eccezione policy** con template fisso pre-approvato (passa comunque da `journalistReview` ma con `mode: silent_audit` su template whitelisted).
   - **(c) UI quick-approve 1-click** in `/v2/funnemail` che invia con review umana lampo.
2. **C3 — Eval set 200 messaggi etichettati**: serve il **dataset reale** (non posso inventarlo). Posso preparare la **struttura tabellare** (`prompt_test_cases` per scope `classify`) e lo **script di import CSV**, poi tu carichi i 200 esempi etichettati. Confermi?

Procedo con tutto il resto già ora. Le fasi sotto sono **indipendenti** e ordinate per rischio crescente.

---

## Fase TRIM (zero migrazioni, low-risk)

**T1 — [S2] Adottare `normalizeSanitizeAndWrap` in 2 edge function classifier**
- File: `supabase/functions/_shared/inboundTriage.ts`, `supabase/functions/classify-email-response/index.ts`.
- Modifica minima: avvolgere il body inbound prima di passarlo all'LLM (pattern già usato in `classify-inbound-message`).
- Rischio: nullo (sanitizer è additivo, fail-open).
- Test: aggiungere caso a `src/test/` o smoke curl.

**T2 — [S10] Spostare system prompt `classify-inbound-message` in DB**
- Creare entry in `operative_prompts` con `scope='classify'`, `tag='inbound-message-system'`.
- Refactor `classify-inbound-message/index.ts` per caricarlo via `loadOperativePrompts()` (loader unificato già esistente).
- Fallback hardcoded preservato se DB vuoto (no regressione).

**T3 — [C5/G2] Few-shot "partner offre lavoro" → `operative_request`**
- Editare prompt `Funnemail Classifier` in `operative_prompts` aggiungendo 2 esempi few-shot (operazione DB via `supabase--insert`, niente codice).
- Versione automaticamente snapshotata in `prompt_versions` dal trigger esistente.

## Fase STANDARD (migration richiesta)

**S1 — [C2/G3] Aggiungere 3 cartelle agenda mancanti**
- Migration: estendere enum `funnemail_folder_kind` (o tabella `funnemail_folders`, da verificare struttura) con `administrative`, `legal_fiscal`, `general_services`.
- Popolare `funnemail_routing_rules` con 3 regole base (pattern dominio/keyword).
- Aggiornare `funnemail-classify` enum response e relativo Zod/JSON schema.
- UI `/v2/agenda/reparti` legge da DB → nessuna modifica frontend richiesta.

**S2 — [C4] Strict JSON schema su 2 edge function**
- `supabase/functions/classify-inbound-content/index.ts` e `funnemail-scout-sender/index.ts`.
- Convertire chiamata LLM da free-form JSON a `tools: [{ type:'function', function:{ name, parameters: { type:'object', properties:{...}, required:[...] } } }]` con `tool_choice` forzato.
- Validazione Zod post-call (pattern già usato in `_shared/aiJsonValidator.ts`).

**S3 — [S1] Promuovere 2 prompt a template Professore**
- Editare in `operative_prompts`: `Group-Aware Classifier` e `Operative Dispatcher Routing`.
- Riscrivere secondo `docs/prompt-standard.md` (5 sezioni: Identità/Obiettivo/Metodo/Guardrail/Output).
- Nessun cambio codice, solo DB insert (snapshot auto via trigger).

**S4 — [S3/G5] Bucket "interesse potenziale"**
- Post-classification in `classify-email-response`: se `category=interested` ma `confidence<0.85` → marcare `lead_status_hint='potential_interest'` invece di `interested`.
- Logica deterministica, niente nuovo prompt.

## Fase CRITICAL (dipende da decisioni sopra)

**Cr1 — C1/G4** → eseguibile solo dopo scelta a/b/c.
**Cr2 — C3** → preparo struttura + script import, esecuzione attende dataset reale.
**Cr3 — S4/G1** ("anticipo job"): hook su `applyLeadStatusChange` che cancella `ai_pending_actions` future con `partner_id+contact_id` matching quando arriva risposta positiva. Migration + edge function patch.

## Fase MISURAZIONE (defer)

BP1 (calibration) e BP5 (A/B test) richiedono eval-set vivo → after C3.

---

## Guardrail (Codex)

- **No tocchi** a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReviewLayer.ts`, `journalistSelector.ts`.
- **No bypass** AI Invocation Charter: tutte le edge AI continuano a passare da `invokeAi` lato client.
- **No DELETE fisico**: tutte le modifiche DB su tabelle business rispettano soft-delete.
- **Modifiche DB business** solo via `supabase--migration` o `supabase--insert`, mai SQL ad-hoc.
- Dopo ogni fase: deploy edge function modificate + smoke curl + verifica `prompt_test_runner` (quando applicabile).
- **Rollback scritto** per ogni migration (Cr3 + S1 includono down-migration nei commenti).

## CHANGELOG atteso

- [ATTESO] T1: 2 file edge function patchati, 0 migration, smoke curl OK.
- [ATTESO] T2: 1 prompt nuovo in `operative_prompts`, 1 file edge function patchato, fallback preservato.
- [ATTESO] T3: 1 row DB aggiornata, snapshot in `prompt_versions`.
- [ATTESO] S1: 1 migration (3 cartelle + enum + routing rules), 1 file edge patchato, UI invariata.
- [ATTESO] S2: 2 file edge patchati (strict schema), 1 set di test Zod aggiunti.
- [ATTESO] S3: 2 prompt riscritti in DB, snapshot auto.
- [ATTESO] S4: 1 file edge patchato, logica deterministica post-LLM.
- [BLOCCATO] Cr1, Cr2, Cr3 in attesa decisioni utente.

## Domande per te (rispondi prima che parta)

1. **C1**: opzione (a), (b) o (c)?
2. **C3**: ok preparare struttura + import CSV e attendere dataset?
3. Vuoi che esegua **TRIM + STANDARD** in un'unica passata, o preferisci **TRIM** prima, verifichi, poi STANDARD?
