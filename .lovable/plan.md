# Round B — Email Lab: Simulazione Funnemail (dry-run)

Aggiungo la seconda tab di `/v2/email-lab` ("Smistamento Funnemail") per visualizzare in tempo reale il ragionamento completo che fa il sistema su una mail in ingresso, **senza side-effect** (no DB writes business, no invii, no classificazioni reali persistite).

## Obiettivo utente
"Voglio vedere tutto ciò che pensa il sistema, gli step, gli input/output di ogni tool, le decisioni di routing, in serie davanti ai miei occhi" — applicato al flusso inbound (`classify-inbound-message`).

## Architettura

```text
┌─────────────────────────────────────────────────────────┐
│ FunnemailTab (UI)                                       │
│  ├── Form input: from, subject, body, html opzionale    │
│  ├── Bottone "Simula smistamento" → genera trace_id     │
│  └── Timeline live (polling pipeline_traces by trace_id)│
│      ├── Stage cards in ordine: injection → classify    │
│      │    → scout → route → policy                      │
│      ├── Per stage: input, output, AI prompt, latenza,  │
│      │    decisione, eventuali warning/blocchi          │
│      └── Verdict finale: gruppo, routing, confidence    │
└─────────────────────────────────────────────────────────┘
              │ invoke
              ▼
┌─────────────────────────────────────────────────────────┐
│ Edge: simulate-funnemail-classify (NUOVA)               │
│  - Wrapper read-only sopra gli stage modulari di        │
│    classify-inbound-message                             │
│  - Genera trace_id, scrive SOLO su pipeline_traces      │
│    (con flag simulation=true)                           │
│  - NESSUN insert in messages/email_messages/contacts    │
│  - NESSUN trigger di reply o autoresponder              │
│  - Riusa _shared/operativePromptsLoader, sanitizer,     │
│    contentNormalizer (passano da centralized builder)   │
└─────────────────────────────────────────────────────────┘
              │ logs
              ▼
   pipeline_traces (already exists) — filter by trace_id
```

## Cosa costruisco

### Backend
1. **Nuova edge function** `supabase/functions/simulate-funnemail-classify/index.ts`
   - Auth: `verify_jwt = false` + validazione JWT in-code (operatore loggato).
   - Body: `{ from, subject, body, html? }` validato con Zod.
   - Esegue gli stage di `classify-inbound-message` riusando i moduli `_shared/` esistenti (sanitizer, normalizer, operativePromptsLoader, journalistReview NON applicabile qui).
   - Hard guard: `simulation = true` blocca ogni `supabase.from('messages')`/`partners`/`contacts`/`email_messages` insert/update.
   - Logga ogni step su `pipeline_traces` con `trace_id` + `simulation=true`.
   - Risposta: `{ trace_id, verdict }`.
2. **Migration** (se serve): aggiungo colonna `simulation boolean default false` su `pipeline_traces` se non c'è già; index su `trace_id`.

### Frontend (UI logic-less + hooks)
3. **Hook** `src/v2/hooks/email-lab/useFunnemailSimulation.ts`
   - `runSimulation(input)` → chiama edge via `invokeAi({ scope: 'email_lab_simulation', ... })` (rispetta AI Invocation Charter).
   - Polling `pipeline_traces` per `trace_id` (interval 800ms, stop su verdict o timeout 30s).
4. **Hook** `src/v2/hooks/email-lab/usePipelineTraceStream.ts` — wrapper realtime opzionale (subscribe `postgres_changes`).
5. **Componenti** in `src/v2/ui/organisms/email-lab/funnemail/`
   - `FunnemailInputCard.tsx` — form mittente/oggetto/corpo.
   - `PipelineTimeline.tsx` — lista verticale di `StageCard`.
   - `StageCard.tsx` — input/output/prompt/latenza/decisione (collassabili).
   - `VerdictCard.tsx` — gruppo finale, confidence, routing, warning.
6. **Update** `src/v2/ui/pages/EmailLabPage.tsx` — sostituisco placeholder Funnemail con `<FunnemailTab />`.
7. **Banner strumenti** (Round A) — aggiungo link a `/v2/pipeline-traces` con filtro `simulation=true`.

### Governance / sicurezza
- Scope AI nuovo: `email_lab_simulation` in `ai_scope_registry` (migration).
- Editorial review NON si applica (no produzione testo verso esterni).
- Sanitizer + content normalizer attivi su input utente.
- Soft-delete N/A (no business inserts).
- Memoria: nessuna nuova memoria globale; documenta solo se diventa standard.

## File creati
- `supabase/functions/simulate-funnemail-classify/index.ts`
- `src/v2/hooks/email-lab/useFunnemailSimulation.ts`
- `src/v2/hooks/email-lab/usePipelineTraceStream.ts`
- `src/v2/ui/organisms/email-lab/funnemail/FunnemailInputCard.tsx`
- `src/v2/ui/organisms/email-lab/funnemail/PipelineTimeline.tsx`
- `src/v2/ui/organisms/email-lab/funnemail/StageCard.tsx`
- `src/v2/ui/organisms/email-lab/funnemail/VerdictCard.tsx`

## File modificati
- `src/v2/ui/pages/EmailLabPage.tsx` (montaggio FunnemailTab)
- `src/lib/queryKeys.ts` (chiavi `emailLab.simulation`)
- `src/data/aiScopeRegistry.ts` (se necessario aggiungere scope) o migration su `ai_scope_registry`

## Migrazioni DB
1. `ai_scope_registry`: insert scope `email_lab_simulation`.
2. `pipeline_traces`: aggiungo `simulation boolean default false` + index su `trace_id` se mancanti.

## Out of scope (rimandati a Round C)
- Confronto side-by-side più simulazioni.
- Editor inline dei prompt operativi dalla timeline.
- Replay di trace esistenti caricandoli da `/v2/pipeline-traces`.

## Check pre-"fatto"
- Nessun insert business in DB durante simulazione (verificato con guard).
- Nessuna invocazione AI fuori da `invokeAi` (charter rispettato).
- Timeline mostra stage in ordine con input/output/prompt/latenza.
- Funziona anche se realtime fallisce (polling fallback).
- Zero modifiche a `check-inbox` / `email-imap-proxy` / `mark-imap-seen`.
