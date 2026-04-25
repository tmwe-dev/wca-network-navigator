
# 🧑‍🏫 Gordon — Curatore Prompt-Lab

Implemento end-to-end la vista Singola con chat persistente per ogni proposta, agente Gordon dedicato con voce, e loop di apprendimento opzionale.

---

## Step 1 — Creazione agente Gordon (migration DB)

INSERT in `agents`:
- `name`: Gordon
- `role`: curator
- `avatar_emoji`: 🧑‍🏫
- `is_active`: true
- `elevenlabs_voice_id`: `JBFqnCBsd6RMkjVDRZzb` (George — voce maschile autorevole, ottima resa IT)
- `system_prompt`: persona di Curatore che:
  - legge `HarmonizeProposal` (target_table, target_id, before, after, reasoning)
  - spiega in italiano semplice il *perché* della proposta
  - accetta correzioni dall'utente (es. "la sede è Peschiera, non Segrate")
  - rigenera l'`after` quando richiesto, emettendo blocco delimitato `[REGENERATED_AFTER]…[/REGENERATED_AFTER]`
  - quando individua un pattern generalizzabile, propone una regola permanente con `[SUGGEST_KB_RULE]…[/SUGGEST_KB_RULE]`
  - tono didascalico, breve, mai gergo tecnico se non richiesto

Conforme a memoria `agents/persona-system` e `agents/global-visibility` (visibile a tutti gli operatori).

---

## Step 2 — Estensione dati (no schema change)

`src/data/harmonizeRuns.ts`:
- estendo tipo `HarmonizeProposal` (JSONB in `harmonize_runs.proposals`):
  ```ts
  chat?: Array<{ role: 'user'|'assistant'; content: string; ts: string }>
  user_correction_note?: string
  regenerated_after?: string
  ```
- nuova funzione `appendProposalChat(runId, proposalId, message)` con read-modify-write atomico (stesso pattern di `updateHarmonizeProposal` già esistente)

---

## Step 3 — Edge function `harmonize-proposal-chat`

`supabase/functions/harmonize-proposal-chat/index.ts`

Struttura standard (vedi `docs/EDGE-FUNCTIONS.md`): CORS dinamico whitelisted, `requireAuth`, security headers, monitoring, validazione Zod input, sotto 200 LOC.

Input:
```ts
{ run_id: string, proposal_id: string, agent_id: string, user_message: string }
```

Logica:
1. Carica `agents.system_prompt` di Gordon (via service role)
2. Carica proposta dal JSONB `harmonize_runs.proposals`
3. Costruisce `messages = [system + contesto_proposta_serializzato, ...chat_history, user_message]`
4. Chiama Lovable AI Gateway → `google/gemini-3-flash-preview` (default consigliato)
5. Estrae eventuali blocchi `[REGENERATED_AFTER]` e `[SUGGEST_KB_RULE]`
6. Persiste user_message + assistant_reply nel `chat[]` della proposta
7. Risponde `{ reply, regenerated_after?, suggested_rule? }`

Gestione 429/402 con messaggi user-friendly (memoria `architecture/ai-gateway-and-budgeting`).

---

## Step 4 — Riuso TTS esistente

Verifico se `supabase/functions/elevenlabs-tts/index.ts` è già presente (lo è — già usato in `AgentChat.tsx`). Lo riuso per la voce di Gordon, nessuna nuova edge function.

---

## Step 5 — UI: toggle Lista ↔ Singola

### 5.1 — `SuggestionsReviewPage.tsx` (modifica)
Aggiungo in alto:
- Toggle 📋 Lista / 🧑‍🏫 Singola con Gordon
- Stato `viewMode` salvato in localStorage

La vista Lista resta intoccata (l'inversione layout fatta nello step precedente è preservata).

### 5.2 — `SingleProposalReview.tsx` (nuovo)
Layout 2 colonne (stack su mobile <768px):
- **Sinistra**: navigatore (◀ idx/total ▶) + AZIONE/TARGET + `EditableAfter` (riusa componente esistente) + collapsible "Spiegazione e dettagli" + bottoni Applica/Salta/Rifiuta
- **Destra**: `GordonChatPanel`

### 5.3 — `GordonChatPanel.tsx` (nuovo)
- Bolle chat con `ReactMarkdown` per Gordon
- Bottone 🔊 su ogni risposta Gordon → POST a `elevenlabs-tts` → autoplay
- Input con `useContinuousSpeech` (riuso da `AgentChat`) per dettatura vocale
- Quando arriva `regenerated_after`: mostra preview + 2 bottoni:
  - **✓ Usa solo qui** → chiama `editProposalAfter()` esistente
  - **✓ Usa qui + salva come regola permanente** → editProposal + insert in `suggested_improvements` (kb_rule, status=approved)
- Quando arriva `suggested_rule` da Gordon proattivamente: mostra card "Vuoi salvare questa regola permanente?" con conferma

### 5.4 — `ProposalNavigator.tsx` (nuovo)
Componente atomico con frecce ◀ ▶, contatore "12 di 154", skip non distruttivo.

### 5.5 — Hook `useGordonChat.ts` (nuovo)
- Gestisce conversazione, invocazione edge function, persistenza locale + remota
- Pattern Resilienza Async (memoria `tech/async-hook-resilience-pattern`): `AbortController` + `mountedRef`

---

## Step 6 — Loop di apprendimento ("Chiedi ogni volta")

In `useHarmonizeOrchestrator.ts`:
- Nuova API `applyRegeneratedAfter(proposalId, newAfter, saveAsRule: boolean)`
- Se `saveAsRule = true` → INSERT in `suggested_improvements` (categoria `kb_rule`, fonte `gordon-feedback`)

In `harmonizeAnalyzer.ts`:
- Prima di chiamare l'analyzer, fetch delle `suggested_improvements` approvate (categoria `kb_rule`)
- Inietta come "VINCOLI APPRESI DAGLI OPERATORI" nel prompt → Marco le rispetta nei prossimi run

---

## 📁 File toccati

**Nuovi**:
- `supabase/functions/harmonize-proposal-chat/index.ts`
- `src/v2/ui/pages/prompt-lab/components/SingleProposalReview.tsx`
- `src/v2/ui/pages/prompt-lab/components/GordonChatPanel.tsx`
- `src/v2/ui/pages/prompt-lab/components/ProposalNavigator.tsx`
- `src/v2/ui/pages/prompt-lab/hooks/useGordonChat.ts`

**Modificati**:
- `src/v2/ui/pages/prompt-lab/SuggestionsReviewPage.tsx` (toggle Lista/Singola)
- `src/data/harmonizeRuns.ts` (tipo esteso + `appendProposalChat`)
- `src/v2/ui/pages/prompt-lab/hooks/useHarmonizeOrchestrator.ts` (`applyRegeneratedAfter`)
- `src/v2/ui/pages/prompt-lab/hooks/harmonizeAnalyzer.ts` (iniezione regole apprese)

**Migration DB**: 1 INSERT (creazione Gordon)

---

## ✅ Esecuzione

Una volta approvato, eseguo tutto monoliticamente in autonomia (rispettando la tua preferenza "no step-by-step"). Al termine del run avrai:
- toggle vista Lista/Singola sulla pagina suggerimenti
- chat persistente per ogni proposta con Gordon
- voce George attivabile su ogni risposta Gordon
- conferma esplicita per salvare correzioni come regole permanenti
- prossimi run di armonizzazione che rispettano le regole apprese

Confermi e parto?
