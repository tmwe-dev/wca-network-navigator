## Audit della pipeline email/outreach — stato attuale

Mappa di tutti i punti dove l'app prepara messaggi (email, WA, LinkedIn) e di **quali fasi della pipeline ufficiale** ciascuno applica oggi:

```text
Pipeline ufficiale dichiarata:
1) Email Contract       (buildEmailContract → validateEmailContract)
2) Type Detector        (detectEmailType: blocca conflitti tipo/storia)
3) Oracolo / Context    (assembleContextBlocks: KB + history + warmth + decisione)
4) Decision Engine      (azione, tono, journalist consigliato)
5) Prompt Lab           (loadOperativePrompts + Calligrafia)
6) AI Gateway           (model + retry)
7) Giornalista finale   (journalistReview: edit / warn / block)
8) Audit + Credits      (supervisor_audit_log, deduct_credits)
```

| # | Superficie / Hook | Edge function chiamata | Contract | Detector | Oracolo | Decision | Prompt Lab | Giornalista | Note |
|---|-------------------|------------------------|:--------:|:--------:|:-------:|:--------:|:----------:|:-----------:|------|
| A | Command — `composeEmail` (singolo + batch country-wide) | `generate-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| B | Command — `ComposerCanvas.handleGenerate` (rigenera batch + singolo) | `generate-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| C | Email Composer V1 / `/v2/communicate/compose` (`useEmailComposerState.handleAIGenerate`) | `generate-content` → `generate-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK (via proxy) |
| D | Email Composer V1 — Improve (`handleAIImprove`) | `improve-email` | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | OK (Decision non applicabile) |
| E | Email Forge (`useEmailForge`) | `generate-email` (`_debug_return_prompt`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK + ispezione prompt |
| F | Pending Actions Panel — Regenerate draft (AI Control) | `generate-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| G | Sorting / Activity AI draft (`useEmailGenerator`) | `generate-content` → `generate-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| H | **Cockpit AI Draft Studio** — canali WA / LinkedIn / Email cold (`useOutreachGenerator`) | `generate-content` → `generate-outreach` | **❌** | **❌** | ✅ | ✅ | ✅ | **❌** | Mancano Contratto + Giornalista anche per il canale email |
| I | **Cadence Engine** (campagne automatiche, qualsiasi canale) | `generate-outreach` (fetch diretto) | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | Idem |
| J | **Agent Execute** (LUCA autonomo) — `send_email_to_partner` / `send_outreach` | `generate-outreach` (fetch diretto) | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | Idem |
| K | **Outreach platform tool** (esposto agli agenti) | `generate-outreach` | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | Idem |
| L | Bulk LinkedIn Dispatch (`useBulkLinkedInDispatch`) | `send-linkedin` direttamente | n/a | n/a | n/a | n/a | n/a | n/a | Invia testo già preparato (non genera) |

### Verdetto rapido
- Tutto ciò che passa per `generate-email` (singolo, batch, composer, AI Control, Email Forge) è **conforme**.
- Tutto ciò che passa per `generate-outreach` (Cockpit canali, Cadence Engine, agente autonomo, platform tool) **salta due livelli del nostro processo**: l'**Email Contract / Type Detector** (che blocca conflitti tipo/stato/blacklist) e il **Giornalista finale** (caporedattore, edits + verdetto block/warn).
- Conseguenza concreta: una mail cold generata dal Cockpit, una sequenza spedita dal Cadence o un'azione autonoma di LUCA può uscire **senza il giro di controllo del Giornalista** e senza la validazione del contratto. Questo spiega anche perché alcune mail "cockpit" risultano stilisticamente diverse da quelle dell'Email Forge a parità di partner.

### Plus / debiti collaterali rilevati durante l'audit (non bloccanti)
1. **Cockpit canale "email"**: `useOutreachGenerator` viene usato anche per il canale email all'interno dell'AIDraftStudio → genera bozze email **fuori** dalla pipeline `generate-email`.
2. **Calligrafia** è iniettata in entrambe le edge function ma il **Journalist** è solo in `generate-email`/`improve-email` → asimmetria.
3. **`useEmailComposerState.handleAIGenerate`** monta un `effectiveGoal` con etichetta "ISTRUZIONI SPECIFICHE DELL'UTENTE" — ok, ma resta hard-coded nel client invece di essere un prompt operativo del Prompt Lab.

---

## Piano di intervento

Nessuna modifica al comportamento percepito dall'utente sulle superfici già conformi. L'obiettivo è **chiudere il gap su `generate-outreach`** in modo trasparente, così che ogni superficie applichi le stesse fasi.

### Step 1 — Estrarre Journalist + Contract come hook condiviso
- Wrappare l'attuale logica già presente in `generate-email/index.ts` (blocco "GIORNALISTA AI — Caporedattore Finale" + costruzione contratto/detector) in un modulo `_shared/postGenerationReview.ts` con due funzioni:
  - `runEmailContract(supabase, userId, args)` → `{ contract, typeResolution, warnings, error? }`
  - `runJournalistReview(supabase, userId, draft, ctx, channel)` → `{ verdict, edited_text, warnings, edits, quality_score, journalist }`
- Comportamento per canale:
  - `email` → contract + journalist obbligatori (come oggi).
  - `whatsapp` / `linkedin` → contract opzionale (no validazione email/blacklist se non applicabile), journalist obbligatorio con strictness ridotta (rispetta limiti caratteri, no HTML).

### Step 2 — Integrare in `generate-outreach`
- Dopo `parseOutreachResponse`, invocare `runJournalistReview` con il canale corretto.
- Per canale `email`, invocare anche `runEmailContract` prima della build dei prompt (come fa `generate-email`).
- Restituire nel JSON di risposta `journalist_review` e `contract_used` / `contract_warnings` / `type_resolution`, allineati a `generate-email`.
- Mantenere retro-compat: il client che ignora questi campi continua a funzionare.

### Step 3 — Esporre il verdetto al Cockpit / AI Control
- `useOutreachGenerator`: salvare `journalist_review` accanto a `result`; in caso di `verdict === "block"`, mostrare un toast di warning e disabilitare il pulsante "Invia" finché l'utente non conferma override.
- `AIDraftStudio`: pannello inline con i suggerimenti del Giornalista (riusare il componente già usato dall'Email Forge se esiste).

### Step 4 — Cadence Engine + Agent Execute
- Niente UI: leggere `journalist_review.verdict` lato server.
  - `block` → il messaggio non viene inviato; si crea un'`ai_pending_actions` per revisione umana (riusa il flusso esistente).
  - `warn` → invio consentito ma loggato in `supervisor_audit_log` con dettaglio warning.
  - `pass_with_edits` → si usa `edited_text`.

### Step 5 — Telemetria pipeline
- Nuova tabella o vista `pipeline_audit` (oppure colonna `pipeline_phases` su `supervisor_audit_log`) che salvi per ogni generazione: `{contract_ok, type_resolution, journalist_verdict, prompt_lab_ids, model}`.
- Permette a Prompt Lab → tab "Catalog" di mostrare per ogni superficie quante volte le fasi sono state effettivamente applicate (oggi non è tracciato per `generate-outreach`).

### Step 6 — Pulizia minore
- Allineare il commento "no side effects" su `generate_outreach` nel `systemManifest.ts` (oggi dichiara "no side effects": vero per il draft, ma con journalist=block diventa indirettamente input al Decision Engine — aggiornare la riga).
- Aggiungere test su `_shared/postGenerationReview.ts` (verdetto block per email senza saluto, verdetto pass per WA con limite caratteri rispettato).

---

## Dettagli tecnici (per la fase di build)

- **File toccati lato edge**: `supabase/functions/_shared/postGenerationReview.ts` (nuovo), `supabase/functions/generate-outreach/index.ts`, `supabase/functions/generate-email/index.ts` (refactor che importa il nuovo modulo, comportamento invariato), `supabase/functions/cadence-engine/index.ts`, `supabase/functions/agent-execute/toolHandlers/emailTools.ts`, `supabase/functions/_shared/platformTools/outreachHandler.ts`, `supabase/functions/_shared/platformToolHandlers/outreachTools.ts`, `supabase/functions/_shared/toolHandlersWrite.ts`.
- **File toccati lato client**: `src/hooks/useOutreachGenerator.ts` (espone `journalist_review`), `src/components/cockpit/AIDraftStudio.tsx` (UI verdetto), `src/v2/ui/pages/prompt-lab/utils/systemManifest.ts` (riga 134).
- **Migrazione DB**: opzionale, solo se confermiamo Step 5 (telemetria). Niente RLS nuovi: la riga eredita le policy di `supervisor_audit_log`.
- **Backward compatibility**: i campi nuovi sono additivi; i client vecchi continueranno a funzionare. Nessun rename di endpoint.

## Cosa NON è in scope
- Riscrittura del Prompt Lab.
- Modifica del routing del Command (già sistemato nei round precedenti).
- Cambi al motore di invio (`send-email`, `send-whatsapp`, `send-linkedin`).
- Tocco a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria: vietato senza autorizzazione).

Confermi questo piano? Se sì, procedo dallo Step 1 (modulo `_shared/postGenerationReview.ts`) e poi Step 2 (`generate-outreach`).