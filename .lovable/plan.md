## Mappa di cosa esiste già

### Per la produzione email
- **`/v2/email-forge`** (Lab AI semplificato): pannello config destinatario + tipo + tono + KB → chiama `generate-email` con `_debug_return_prompt=true`. Ritorna draft + system/user prompt assemblato + blocchi + journalistReview (verdict, warnings, edits, quality_score, reasoning) + context summary + tokens + latenza. Ha già "rigenera con override prompt".
- **`improve-email`** edge function già wired in `useEmailComposerState` per migliorare una bozza esistente.
- **`analyze-email-edit`** edge function per diff/analisi modifiche manuali sulla bozza.
- **`journalistReview`** è incluso nella response di ogni `generate-email`/`improve-email` (verdetto + edits applicati + reasoning).
- Limite attuale: **mostra solo l'ULTIMA versione**. Non vedi v1→v2→v3 affiancate.

### Per la lettura/smistamento Funnemail
- **`classify-inbound-message`** orchestratore con stage modulari: `injection_guard` → `classified` (AI) → `scouted` → `routed` → `policy_applied` → `triage`. Ogni stage scrive in `pipeline_traces`.
- **`/v2/pipeline-traces`**: vista live + per trace + per step. Filtra per `trace_id` e mostra timeline cronologica.
- **`funnemail-policy-engine`**, **`funnemail-auto-route`**, **`funnemail-classify`** sono edge separate richiamate dagli stage.
- Limite attuale: la pipeline parte da inbound REALE (trigger pg_net su `channel_messages`). Non c'è un endpoint "simula questa email finta e mostrami il viaggio".

### Per i prompt — già disponibile
- **`/v2/ai-staff/prompt-lab`**: tab Operative Prompts, Email Prompts, Personas, Capabilities, Routing, Playbooks, Journalists, Voice, KB Doctrine, System Prompt, Audit, Prompt History, Prompt Tests, **Simulator**, AI Profile.
- **`/v2/prompt-lab/catalog`**: catalogo unificato prompt operativi versionati (versione, autore, orchestratori, input).
- **`/v2/prompt-lab/atlas`**: atlas agenti.
- **`/v2/prompt-lab/suggestions`** e **`/v2/prompt-lab/proposals`**: review proposte AI per migliorare i prompt.
- **`/v2/prompt-lab/tests`** + **`/v2/ai-test-hub`**: scenari salvati in DB con assertions pass/fail (`ai_test_scenarios` + `useAiTestHub`).
- **SimulatorTab**: dato un agente + messaggio, mostra system prompt assemblato identico a `agent-loop`, persona caricata, tool whitelist, hard guards, e (opzionale) dry-run AI con `tool_calls` proposti SENZA eseguirli.
- **`/v2/ai-interactions-log`**: storico messaggi AI con thumbs up/down + export CSV.
- Versioning prompt: `prompt_versions` (snapshot immutabili via trigger), `prompt_test_cases`, `prompt_test_runs`, helper `rollback_prompt_to_version()`.

**Risposta diretta alla tua domanda**: NO, non c'è una pagina che ti mostra in serie le bozze prodotte iterativamente dagli agenti, né una pagina che ti mostra il "viaggio" passo-passo di un'email Funnemail simulata. Hai i mattoni separati (Forge per produzione, PipelineTraces per lettura, Simulator per dry-run agente), ma manca la vista unificata "tutto davanti agli occhi".

---

## Proposta — nuova pagina `/v2/email-lab`

Una pagina con 2 tab. UI compatta, dark-friendly, riusa i componenti già esistenti.

### Tab 1 — "Produzione email · serial agents"

Layout verticale:

```text
┌────────────────────────────────────────────────────────────┐
│  CONFIG (riuso ForgeOraclePanel)                           │
│  destinatario · tipo · tono · KB · goal · base_proposal    │
└────────────────────────────────────────────────────────────┘
[ Genera bozza ]  [ Migliora bozza corrente ]  [ Reset serie ]

┌─v1 generate─┐ ┌─v2 improve─┐ ┌─v3 improve─┐ ┌─v4 override─┐
│ subject     │→│ subject    │→│ subject    │→│ subject     │
│ body        │ │ DIFF v1    │ │ DIFF v2    │ │ DIFF v3     │
│ journalist  │ │ journalist │ │ journalist │ │ journalist  │
│ model · ms  │ │ model · ms │ │ model · ms │ │ model · ms  │
│ [prompt ▾]  │ │ [prompt ▾] │ │ [prompt ▾] │ │ [prompt ▾]  │
└─────────────┘ └────────────┘ └────────────┘ └─────────────┘
                                              ← scroll →
```

Comportamento:
- "Genera bozza" → invoca `useEmailForge.run()` esistente, push del risultato in `iterations: ForgeResult[]`.
- "Migliora bozza corrente" → nuovo hook `useImproveIteration` che chiama `improve-email` passando l'ULTIMO `iterations[i]` come input + journalistReview ricevuto, push del risultato come nuova card.
- Ogni card mostra subject, body (markdown render), badge journalist (pass/warn/block + quality_score), model + latenza + tokens, accordion "system prompt", accordion "user prompt", accordion "blocks", e — dalla v2 in poi — un toggle "DIFF" che evidenzia inline rosso/verde rispetto alla card precedente (riuso `diff-match-patch` o algoritmo word-level semplice).
- "Reset serie" svuota `iterations`.
- Stato 100% locale (no persistenza DB) — è un laboratorio, non production.

### Tab 2 — "Smistamento Funnemail · pipeline live"

Layout verticale:

```text
┌──────────── EMAIL SIMULATA ────────────────────────────────┐
│ from:    [_______________]  to: [_____________]            │
│ subject: [______________________________________________]  │
│ body:    [textarea grande                              ]   │
│          [                                              ]  │
│ [ Simula smistamento ]                                     │
└────────────────────────────────────────────────────────────┘

┌─PIPELINE STEPS (cronologico, auto-refresh 2s)──────────────┐
│ 1. injection_guard       ✓ 12ms   payload: {...}           │
│ 2. ai_classification     ✓ 1.4s   prompt usato │ output AI │
│    └─ category: newsletter · confidence: 0.92              │
│    └─ reasoning: "Mittente automatico, link unsubscribe…"  │
│ 3. funnemail_scout       ✓ 80ms   sender_known: true       │
│ 4. funnemail_auto_route  ✓ 230ms  folder: Newsletter       │
│    └─ reason: "Pattern domain match"                       │
│ 5. policy_applied        ✓ 410ms  actions: 2 / executed: 2 │
│    └─ archive · mark_read                                  │
│ 6. triage_alert          skipped  no high-priority match   │
└────────────────────────────────────────────────────────────┘
```

Comportamento:
- L'utente compila un'email finta e clicca "Simula smistamento".
- Il client genera un `trace_id` UUID, chiama una nuova edge function `simulate-funnemail-classify` (o `classify-inbound-message` con flag `_simulation: true` se preferiamo non aggiungere nuove edge — da decidere).
- L'edge esegue gli stessi stage di classify-inbound-message MA: non insert in `channel_messages`, non manda autoresponder, non esegue azioni reali. Marca tutti gli stage in `pipeline_traces` con il `trace_id` fornito.
- La UI fa polling su `pipeline_traces` filtrato per `trace_id` ogni 2s finché non vede `done` o errore, e renderizza le card stage in ordine cronologico (riusa stile `PipelineTracesPage`).
- Per ogni stage espandibile: input payload, output payload, prompt AI (se applicabile), risposta AI (se applicabile), durata, status.

### Sezione condivisa — "Strumenti già attivi sui prompt"

In cima alla pagina, banner collassabile con 8 link card:
- Prompt Lab (editor) · Prompt Catalog · Atlas · Suggestions · Proposals · Tests · Pipeline Traces · AI Interaction Log
- Ogni card: icona + 1 riga di descrizione + link.

---

## Dettagli tecnici

- File principali: `src/v2/ui/pages/EmailLabPage.tsx`, sotto-componenti in `src/v2/ui/pages/email-lab/{ProductionTab.tsx, FunnemailTab.tsx, IterationCard.tsx, DiffView.tsx, ToolsBanner.tsx}`.
- Route: `/v2/email-lab` (lazy in `routes.tsx`, registry navigation).
- Hook nuovi: `src/v2/hooks/useEmailLabIterations.ts` (gestisce array iterations + chiamate generate/improve), `src/v2/hooks/useFunnemailSimulation.ts` (POST a edge + polling pipeline_traces).
- Edge function nuova (Tab 2): `supabase/functions/simulate-funnemail-classify/index.ts` — wrapper read-only attorno agli stessi stage di `classify-inbound-message`, senza side-effect (no insert messaggi, no send, no policy execute), accetta payload finto e `trace_id` dal client.
- Riuso totale: `ForgeOraclePanel`, `useEmailForge`, `pipelineTraces` DAL, `MailRowChrome` per render preview email.
- Vincoli rispettati: niente `supabase.from()` in UI (passa via DAL `pipelineTraces` esistente), niente bypass `journalistReview` (lo MOSTRO, non lo salto), niente direct AI invoke (uso `invokeAi`/`invokeEdge` esistenti), niente `any`.
- Stato locale (Tab 1): `useState<ForgeResult[]>` — la serie esiste solo in sessione, è un laboratorio.

---

## Round (atomicità)

1. **Round A** — scaffold pagina + Tab 1 "Produzione serial" con generate/improve a catena, card affiancate, diff view, accordion prompt. ~6 file.
2. **Round B** — Tab 2 "Smistamento" con nuova edge `simulate-funnemail-classify` (read-only) + polling pipeline_traces + render timeline. ~4 file + 1 edge function nuova.
3. **Round C** — Banner "Strumenti già attivi sui prompt" + voce navigation + breadcrumb + memoria mem dedicata.

Confermi che parto da Round A? Oppure preferisci che faccia prima la mappa "Strumenti già attivi" (Round C) come scoperta, e poi A e B?