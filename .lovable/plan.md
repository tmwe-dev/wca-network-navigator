# Piano di consolidamento architetturale

Obiettivo: ridurre il debito "doppia anima" e la frammentazione **senza cambiare il comportamento**. Ogni fase è isolata, reversibile e verificata con build + ESLint + test E2E esistenti prima di passare alla successiva.

## Stato reale rilevato (rettifica dei draft)
- `src/pages/` è **già svuotato** (resta solo `admin/`). I draft `v2-migration-batch-1/2/3` e `MIGRATION_STATUS.md` sono **obsoleti**: le pagine v2 NON importano più da `@/pages`.
- Il legacy residuo vive in `src/components`: **10 pagine v2** montano ancora una "View" v1 (es. `AgentsPage` → `AgentChatHubView`).
- Violazioni a `warn` da promuovere: **128** component→DAL, **83** `supabase.from` diretti fuori dal DAL, **16** hook→component.
- Edge function: **149**; risk gate (`aiActionRiskGate.ts`) cablato solo in `cadence-engine`.
- Sottosistemi AI parzialmente sovrapposti: `command/tools`, `agent-loop`, `superMario`, `unified-assistant`, Prompt Lab, WCA bridge.

---

## Fase 1 — Allineare la documentazione e chiudere la "doppia anima" v1
Scopo: rendere vero ciò che i draft promettono, eliminando il legacy effettivamente morto.

1. Aggiornare `docs/v2/MIGRATION_STATUS.md` allo stato reale (rigenerare inventario: wrapper = solo le 10 view in `src/components`).
2. Per le **10 pagine wrapper** (`AgentsPage`, `AgentChatHubPage`, `StaffPage`, `KnowledgeBasePage`, ecc.): assorbire la "View" legacy dentro `src/v2/ui/pages` o `src/v2/ui/organisms`, mantenendo identico markup/comportamento, poi rimuovere il file v1 in `src/components` solo se non più referenziato (verifica con `rg`).
3. Chiudere/archiviare i 3 draft `v2-migration-batch-*` (superati) e tenere aperto solo ciò che resta reale.
4. Verifica: build verde, `rg "@/components/.*View" src/v2` = 0, E2E di navigazione (`e2e/navigation.spec.ts`, `08-v2-navigation.spec.ts`) passano.

## Fase 2 — Applicare le regole architetturali a step (warn → error)
Approccio incrementale per dominio: si bonifica, poi si promuove a `error`, così la CI non si rompe mai in blocco.

1. **hook→component (16)**: spostare i tipi condivisi in `src/types/` (già previsto dal draft batch-1: `cockpit.ts`, `contacts.ts`, ecc.). Promuovere quella regola in `eslint.config.js` da `warn` a `error`.
2. **component→DAL (128)**: bonifica per cartella (`cockpit`, `contacts`, `email`, `acquisition`…), avvolgendo le chiamate DAL in hook esistenti o nuovi (`useXxx`). A cartella pulita, restringere il `group` della regola a `error` solo per quella cartella.
3. **`supabase.from` diretti (83)**: spostare ogni query nel modulo DAL di dominio in `src/data/`. La regola `no-restricted-syntax` su `supabase.from` è **già `error`** ma con `ignores`; rimuovere progressivamente gli ignore residui.
4. Dopo ogni dominio: `eslint` mirato + build + test del dominio. Nessun big-bang.

## Fase 3 — Semplificare i sottosistemi AI (stesso risultato, meno concetti)
Scopo: un solo entry point logico, deprecando i layer ridondanti. Prima una **mappa d'impatto** per ciascun sottosistema (chi lo chiama, cosa fa), poi rimozione minima.

1. Censire i sottosistemi: `command/tools`, `agent-loop`, `superMario`/`superMarioFlag`, `unified-assistant`, Prompt Lab, WCA bridge — documentare in `docs/ai/` cosa fa ognuno e le sovrapposizioni reali.
2. Designare **un orchestratore canonico** (il flusso Command + `invokeAi`) e marcare gli altri come adapter sottili o deprecati dietro feature flag (`superMarioFlag`) prima della rimozione.
3. Rimuovere il codice morto già individuato (es. flag spenti, branch non raggiunti) con commit piccoli e reversibili, mantenendo `journalistReview`, `promptSanitizer`, injection guard intatti.
4. Verifica: E2E AI (`ai-assistant`, `agent-chat-flow`, `command-malta-batch`, `prompt-lab-flow`) verdi a ogni rimozione.

## Fase 4 — Uniformare il risk gate sulle edge function
Scopo: cablare `runGuardedAction` (claim→gate→exec→finalize) in **tutte** le edge che eseguono azioni AI con effetto (SEND/WRITE/BULK/DESTRUCTIVE), non solo `cadence-engine`.

1. Inventario edge che agiscono su `ai_pending_actions` o inviano (`mission-executor`, `generate-outreach`, `agent-execute`, `pending-action-executor`, `send-email`, `funnemail-*`).
2. Wrapping uniforme con l'helper `_shared/aiActionRiskGate.ts` esistente — modifica locale, nessuna duplicazione di invio.
3. Ridurre la frammentazione: estrarre i pattern ripetuti (CORS, auth JWT, gate) in helper `_shared` già presenti e consolidare le micro-funzioni quasi-duplicate dove sicuro.
4. Verifica: E2E `risk-gate-7-levels`, `wca-risk-gate`, `direct-send-vs-queued-send-consistency`, `dispatch-integrity-flow` verdi.

---

## Dettagli tecnici
- **File regole**: `eslint.config.js` (blocchi righe 75-133 per i passaggi warn→error). Promozioni solo dopo violazioni a zero nel perimetro.
- **DAL**: `src/data/<dominio>.ts` + `queryKeys` centralizzati in `src/lib/queryKeys.ts`.
- **Tipi condivisi**: `src/types/`.
- **Edge gate**: `supabase/functions/_shared/aiActionRiskGate.ts` (`runGuardedAction`).
- **Vincoli da rispettare** (memoria progetto): soft-delete globale, `journalistReview` obbligatorio, no invii/AI duplicati, ordine messaggi e contesto batch preservati, RLS/GRANT invariati.

## Note di esecuzione
- Una fase per volta; ogni sotto-step è un commit piccolo e reversibile.
- Nessun refactor opportunistico fuori scope.
- Dopo l'approvazione procedo end-to-end fase per fase, riportando l'avanzamento senza chiedere conferme intermedie.
