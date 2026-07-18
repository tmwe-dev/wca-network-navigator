## Obiettivo

Semplificare il flusso Command da **7/10 → 5/10** eliminando bypass duplicati e codice morto, **senza toccare nessuna funzionalità utente**: planner, tool registry (62 tool), memoria multi-turn, approvazioni, voce, briefing, canvas restano identici.

## Diagnosi confermata (letta dal codice)

```text
useCommandSubmit.sendMessage()  ← 453 LOC, 3 rami di ingresso al master
 ├─ [BYPASS 1] detectSmalltalk(rawText)      → short-circuit conversazionale
 ├─ [BYPASS 2] runDirectComposer(text,hint)  → fast-lane compose-email
 └─ [STD]      planExecution(...) → planRunner
                └─ se steps=[] : [BYPASS 3] detectSmalltalk(rawText) ripetuto
                                 + regex "looksLikeSearch" → forza ai-query
```

Hook morti (nessun import, solo commenti "intenzionalmente non usati" in `CommandPage.tsx`):
`useAgentLoop`, `useApprovalFlow`, `useScenarioFlow`, `useToolExecution`, `useCommandBriefing`, `useCommandPageState`, `useSuperMarioFlow` + `BriefingPanel` + flag `src/v2/ai/superMarioFlag.ts` → **1.203 LOC morte**.

## Principi

- Zero modifiche al planner edge, al `planRunner`, ai 62 tool, alla `useConversation`, alla governance, alla voce.
- I 3 bypass **non spariscono come comportamento**: vengono spostati dentro un unico classificatore, così l'orchestratore ha un solo `switch(intent)`.
- Ogni step è reversibile con un revert singolo.

---

## Piano passo-passo

### Step 1 — Creare `classifyIntent` (nuovo, non invasivo)

Nuovo file `src/v2/ui/pages/command/lib/intentClassifier.ts`.

```text
classifyIntent(rawText, ctx) → 
  | { kind: "smalltalk", reply, meta }
  | { kind: "compose-email", tool }        // usa TOOLS.find("compose-email").match(text)
  | { kind: "plan" }                       // default: passa al planner
```

Riusa **le stesse funzioni esistenti** (`detectSmalltalk`, `TOOLS.find("compose-email").match`). Nessuna nuova regola.

Test: nuovo `intentClassifier.test.ts` con 6 casi (2 per ogni ramo). Il test esistente `smalltalkDetector.test.ts` resta.

### Step 2 — Refactor di `sendMessage` in `useCommandSubmit.ts`

Sostituire i 3 rami sparsi con un solo dispatch:

```text
const intent = classifyIntent(rawText, { hasComposeMatch: ... });
switch (intent.kind) {
  case "smalltalk":     → risposta Direttore (codice attuale righe 257-270)
  case "compose-email": → runDirectComposer (invariato)
  case "plan":          → planExecution + planRunner (invariato)
}
```

Rimuovere:
- il secondo `detectSmalltalk` post-plan (righe 331-343): non serve più perché il classificatore gira **una sola volta** sul testo grezzo prima della normalizzazione.
- l'`import detectSmalltalk` diretto (ora incapsulato nel classifier).

`runDirectComposer` resta come funzione locale (già osservabile via trace, va bene).

### Step 3 — Isolare `looksLikeSearch` come guardia esplicita

Il fallback anti-allucinazione quando `plan.steps=[]` **resta** (è una feature di sicurezza, non un bypass): lo estraggo in `lib/planFallback.ts` come `shouldForceAiQuery(text)` per pulire `sendMessage`. Nessun cambio di comportamento.

### Step 4 — Archiviare i 7 hook morti + BriefingPanel + superMarioFlag

Spostare (git `mv`) in `src/v2/ui/pages/command/_legacy/` (già pattern usato nel repo):
- `useAgentLoop.ts` (127)
- `useApprovalFlow.ts` (125)
- `useScenarioFlow.ts` (59)
- `useToolExecution.ts` (304)
- `useCommandBriefing.ts` (69)
- `useCommandPageState.ts` (136)
- `useSuperMarioFlow.ts` (216)
- `components/BriefingPanel.tsx` (55)
- `src/v2/ai/superMarioFlag.ts` (27)

Aggiornare i due commenti in `CommandPage.tsx` (righe 10-11 e 36) per rimuovere i riferimenti obsoleti.

Verifico prima dello spostamento che **nessun altro file** li importi (già confermato con `rg`).

### Step 5 — Aggiornare i commenti di intestazione

Il docblock di `useCommandSubmit.ts` (righe 1-20) elenca ancora "3. FLUSSO UNICO". Riscriverlo per riflettere il nuovo dispatch a 3 branch tramite `classifyIntent`.

### Step 6 — Verifica finale

- `rg` per confermare nessun import residuo verso i file archiviati.
- Build + typecheck (auto).
- Test unitari: `smalltalkDetector`, `intentClassifier` (nuovo), tutti gli altri command tests.
- Smoke manuale del flusso: saluto, "componi email a Malta", "quanti partner ha Roma", ricerca nome proprio nudo.

---

## Metriche attese

| Metrica | Prima | Dopo |
|---|---|---|
| LOC `useCommandSubmit.ts` | 453 | ~290 |
| LOC morte in `command/hooks/` | 1.036 | 0 (archiviate) |
| Punti di classificazione intent | 3 | 1 |
| Chiamate a `detectSmalltalk` in submit | 2 | 0 dirette (1 dentro classifier) |
| Rami di ingresso al planner | 3 impliciti | 1 esplicito |
| Complessità percepita | 7/10 | 5/10 |

## Cosa NON tocco (invariante)

- Planner edge `ai-assistant` + failover Lovable AI Gateway.
- `planRunner` (executePlan / executeApprovedStep).
- Tool registry (62 tool) + approvazioni.
- `useConversation` (memoria multi-turn DB).
- `useCommandRealtime`, `useCommandRealtimeVoice`, `useVoiceInput`, `useVoiceOutput`.
- `useGovernance`, `useApprovalHandler`, `usePlanCompletion`, `usePlanExecution`, `useResultCommentary`, `useQueryContext`, `useCommandHistory`, `usePromptAnalysis`.
- Comportamento smalltalk, comportamento fast-lane compose-email, comportamento fallback ai-query.

Zero impatto edge, zero impatto DB, zero migrazione. Reversibile ripristinando gli hook da `_legacy/`.
