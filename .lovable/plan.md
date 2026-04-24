# Armonizza tutto — Piano di implementazione

## Scopo

Affiancare a "Migliora tutto" un secondo strumento, **Armonizza tutto**, che fa refactor profondo del sistema confrontando:

- **stato reale** del DB (prompt, KB, personas, playbook, email rules, agents)
- **stato desiderato** espresso in `LIBRERIA_TMWE_COMPLETA.md` + altri documenti caricati

e produce un **diff strutturato** con proposte tipizzate (UPDATE / INSERT / MOVE / DELETE), ognuna con evidenza, dipendenze e classificazione del gap (testo / contratto backend / policy hard).

"Migliora tutto" resta invariato.

---

## Architettura: dipendenze tra i 5 componenti

```text
                    ┌────────────────────────────────┐
                    │  HarmonizeSystemDialog (UI)    │
                    │  - upload libreria + docs      │
                    │  - goal + scope (tab/agent/all)│
                    └───────────────┬────────────────┘
                                    │ avvia
                                    ▼
        ┌───────────────────────────────────────────────┐
        │  useHarmonizeOrchestrator (hook)              │
        │  fasi: collect → analyze → review → execute    │
        └────┬───────────────────┬──────────────────┬───┘
             │                   │                  │
             ▼                   ▼                  ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ harmonizeCollector│ │ harmonizeAnalyzer│  │ harmonizeExecutor│
   │ (real + desired   │ │ (LLM Harmonizer  │  │ (UPDATE/INSERT/  │
   │  + gap classifier)│ │  prompt + diff)  │  │  MOVE/DELETE)    │
   └──────────┬────────┘ └────────┬─────────┘  └────────┬─────────┘
              │                   │                     │
              └───────────────────┴─────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  harmonize_runs (tabla)  │
                    │  persistenza incrementale│
                    └──────────────────────────┘
                                  ▲
                                  │
                    ┌──────────────────────────┐
                    │  HarmonizeReviewPanel    │
                    │  approva / rifiuta /     │
                    │  modifica per proposta   │
                    └──────────────────────────┘
```

**Ordine di dipendenza forte:**

1. Tabella `harmonize_runs` (nessuna dipendenza)
2. Collector (legge DB + parser libreria; nessuna dipendenza dal resto)
3. Prompt Harmonizer + Analyzer (dipende da collector)
4. Executor (dipende da output dell'analyzer)
5. UI Dialog + Review (dipende da tutto il resto)

---

## Ordine di implementazione

**Fase 1 — Fondamenta dati (no UI)**
1. Migrazione SQL: tabella `harmonize_runs` + RLS + trigger updated_at
2. DAL `src/data/harmonizeRuns.ts` (create / update / appendProposal / markExecuted / cancel / findActive)
3. Caricamento `LIBRERIA_TMWE_COMPLETA.md` come asset statico in `public/kb-source/libreria-tmwe.md` (sorgente versionabile)

**Fase 2 — Collector tri-partito**
4. `harmonizeCollector.ts`:
   - `collectRealInventory(userId)` → riusa `collectAllBlocks` esistente + carica `agents`, `agent_personas`, `kb_entries` (TUTTE, non solo doctrine)
   - `parseDesiredInventory(librarySource, uploadedDocs)` → spacca `## 📄` in entries con `category/chapter/priority/figure`
   - `classifyGaps(real, desired)` → 4 bucket:
     - `text_only` → riscrivibile dal Harmonizer
     - `needs_contract` → richiede nuovo contratto backend (es. EmailBrief)
     - `needs_code_policy` → richiede hard guard / policy
     - `needs_kb_governance` → solo riorganizzazione KB (move/merge/split)

**Fase 3 — Harmonizer LLM**
5. Prompt `HARMONIZER_BRIEFING` in `src/v2/agent/prompts/core/harmonizer-briefing.ts` (versione controproposta, non riusa `PROMPT_LAB_BRIEFING`)
6. `harmonizeAnalyzer.ts`:
   - per ogni gap → chiama Lab Agent con tool calling strutturato
   - output JSON con schema: `{ action, target, evidence, dependencies, impact, tests_required, resolution_layer }`
   - persistenza incrementale in `harmonize_runs.proposals`

**Fase 4 — Executor**
7. `harmonizeExecutor.ts` con un handler per ogni `action`:
   - `UPDATE` → riusa `saveProposal` esistente di `useProposalSaver`
   - `INSERT` → crea nuove righe (kb_entries, agents+agent_personas, operative_prompts...)
   - `MOVE` → cambia `category/chapter/agent_id` mantenendo id
   - `DELETE` → soft delete (`deleted_at` o `is_active=false`); MAI hard delete
8. Audit log per ogni azione tramite `logSupervisorAudit`

**Fase 5 — UI**
9. `HarmonizeSystemDialog.tsx` (sibling di `GlobalImproverDialog.tsx`)
10. `HarmonizeReviewPanel.tsx` — tabella diff con:
    - badge azione (UPDATE/INSERT/MOVE/DELETE)
    - badge resolution_layer (text/contract/code/governance)
    - before/after, evidenza, dipendenze
    - per-row: approva / modifica / rifiuta
    - bulk approve per tipo
11. Bottone "Armonizza tutto" in `PromptLabPage.tsx` accanto a "Migliora tutto"

---

## Contratti dati richiesti

### `HarmonizeAction` (output Analyzer, input Executor)

```ts
type ResolutionLayer = "text" | "contract" | "code_policy" | "kb_governance";
type ActionType = "UPDATE" | "INSERT" | "MOVE" | "DELETE";

interface HarmonizeProposal {
  id: string;                      // uuid client-side
  action: ActionType;
  target: {
    table: "kb_entries" | "agents" | "agent_personas" | "operative_prompts"
         | "email_prompts" | "email_address_rules" | "commercial_playbooks"
         | "app_settings";
    id?: string;                   // null per INSERT
    field?: string;                // per UPDATE parziale
  };
  before?: string | null;          // null per INSERT
  after?: string | null;           // null per DELETE
  payload?: Record<string, unknown>; // per INSERT/MOVE: campi nuovi
  evidence: {
    source: "library" | "real_db" | "uploaded_doc";
    excerpt: string;
    location?: string;             // es. "LIBRERIA_TMWE_COMPLETA.md §Bruce"
  };
  dependencies: string[];          // id di altre proposals che devono passare prima
  impact: "low" | "medium" | "high";
  tests_required: string[];        // es. ["e2e/agent-chat-flow.spec.ts"]
  resolution_layer: ResolutionLayer;
  reasoning: string;               // perché serve
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
}
```

### `harmonize_runs` (nuova tabella)

```sql
CREATE TABLE harmonize_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text,
  scope text NOT NULL DEFAULT 'all',          -- 'all' | 'tab:<name>' | 'agent:<id>'
  status text NOT NULL DEFAULT 'collecting',  -- collecting|analyzing|review|executing|done|cancelled|failed
  real_inventory_summary jsonb,               -- conteggi per tabella
  desired_inventory_summary jsonb,            -- conteggi per category dalla libreria
  gap_classification jsonb,                   -- { text_only:N, needs_contract:N, ... }
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_files jsonb DEFAULT '[]'::jsonb,
  executed_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE harmonize_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own harmonize runs"
  ON harmonize_runs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## Tabelle lette e scritte

**Lettura (collector):**
- `kb_entries` (tutte le category, non solo doctrine)
- `agents`, `agent_personas`
- `operative_prompts`, `email_prompts`, `email_address_rules`
- `commercial_playbooks`
- `app_settings` (system_prompt_blocks, email_oracle_types)
- file statico `public/kb-source/libreria-tmwe.md`

**Scrittura (executor, solo dopo approvazione):**
- `kb_entries` (UPDATE / INSERT / soft-DELETE via `is_active=false`)
- `agents` (INSERT / UPDATE; MAI delete)
- `agent_personas` (INSERT / UPDATE)
- `operative_prompts`, `email_prompts`, `email_address_rules`, `commercial_playbooks` (UPDATE / INSERT)
- `app_settings` (UPDATE)
- `harmonize_runs` (continuo: append proposals, update status)
- `supervisor_audit_log` (audit per ogni azione)

**MAI scritte direttamente:**
- nessuna tabella business reale (contacts, partners, activities, ecc.)
- nessun hard delete su nessuna tabella (rispetta `mem://constraints/no-physical-delete`)

---

## Prompt Harmonizer (uso esatto della tua controproposta)

Il prompt vive in `src/v2/agent/prompts/core/harmonizer-briefing.ts` ed enforce questa struttura output (tool calling, non testo libero):

```text
Per ogni proposta:
- BLOCCO (target tabella + id o "nuovo")
- DIAGNOSI (cosa non quadra confrontando real vs desired)
- AZIONE (UPDATE/INSERT/MOVE/DELETE)
- VERSIONE PROPOSTA (contenuto finale o payload)
- EVIDENZA (citazione dalla libreria o dal DB)
- DIPENDENZE (id altre proposte)
- IMPATTO + TEST
- DECISIONE (text | contract | code_policy | kb_governance)
```

L'enforcement è via tool calling con schema JSON (vedi `HarmonizeProposal`). Niente parsing di markdown.

---

## Rischi tecnici

| Rischio | Mitigazione |
|---|---|
| **Esplosione proposte** (libreria 23 voci × N blocchi reali = centinaia) | Cap di 50 proposte per run; raggruppamento per `target.table`; classifier di priorità nel collector |
| **Dipendenze cicliche tra proposte** | Validazione DAG prima dell'execute; se ciclo → run in stato `failed` con report |
| **DELETE distruttivi** | Solo soft delete (`is_active=false` o `deleted_at`); approvazione manuale obbligatoria per ogni DELETE; bulk approve disabilitato per DELETE |
| **Context window overflow** del LLM con libreria + DB completo | Chunking per sezione libreria; il Harmonizer vede 1 sezione per call + il sottoinsieme rilevante del DB filtrato per category |
| **Esecuzione parziale + crash** | Persistenza incrementale su `harmonize_runs.proposals[].status`; resume cancella solo le `executed`, ri-tenta le `failed` |
| **Conflitto con "Migliora tutto" in corso** | Lock soft: se `findActiveRun` (di `prompt_lab_global_runs`) è attivo, l'avvio Harmonize chiede conferma esplicita |
| **Costi LLM** | Default `google/gemini-3-flash-preview`; opzione "deep" con `gemini-2.5-pro`; budget guardrail riusa `cost-control-guardrails` esistente |
| **Confusione utente tra i due bottoni** | Tooltip espliciti + dialog di intro la prima volta; titoli inequivocabili: "Migliora (riscrive testo)" vs "Armonizza (refactor sistema)" |
| **Tipi Supabase non aggiornati per `harmonize_runs`** | Cast `as never` come fa già `promptLabGlobalRuns.ts`, in attesa che `types.ts` si rigeneri |

---

## Punti che richiedono approvazione manuale

Approvazione obbligatoria, **mai bulk auto-approve**:

1. Ogni proposta `DELETE` (anche se soft)
2. Ogni proposta `INSERT` su `agents` (nuova figura agente)
3. Ogni proposta con `resolution_layer = "contract"` o `"code_policy"` → questa NON viene eseguita: viene solo registrata nel run come "follow-up richiesto" (testo per developer / nuovo task)
4. Ogni proposta con `impact = "high"`
5. Ogni proposta che modifica `system_prompt_blocks` o `system_doctrine`

Approvazione bulk **consentita** per:
- UPDATE testuale di `kb_entries` con `impact ≤ medium`
- UPDATE di `agent_personas.signature_template` / `custom_tone_prompt`
- UPDATE di prompt operativi con `resolution_layer = "text"`

---

## Comportamento esplicito sul collector tri-partito (tuo vincolo)

Il collector restituisce sempre tre output separati e li persiste in `harmonize_runs`:

```ts
interface CollectorOutput {
  real:    InventoryItem[];     // cosa c'è oggi nel DB
  desired: InventoryItem[];     // cosa dice la libreria + docs
  gaps: {
    text_only:        Gap[];    // l'Harmonizer può proporre UPDATE/INSERT testuali
    needs_contract:   Gap[];    // NON tocca, segnala "serve contract <nome>"
    needs_code_policy:Gap[];    // NON tocca, segnala "serve hard guard"
    needs_kb_governance: Gap[]; // MOVE/MERGE/SPLIT entro KB
  };
}
```

L'Harmonizer riceve **solo** `text_only` + `needs_kb_governance` come materiale azionabile. Gli altri due bucket diventano voci read-only nel review panel con etichetta "Richiede intervento sviluppatore" — così non si tenta mai di "scrivere meglio" un problema che è di runtime.

---

## Cosa NON faccio in questa iterazione (out of scope)

- Generazione automatica del codice TypeScript per i nuovi contract backend (resta proposta testuale)
- Esecuzione automatica delle migrazioni SQL eventualmente necessarie
- Rollback automatico oltre il marker per-proposta `status=failed` (no transazioni cross-tabella)
- Modifica del flusso "Migliora tutto" (resta esattamente com'è)

---

## Deliverables finali

- 1 migrazione SQL (`harmonize_runs`)
- 1 file markdown sorgente (`public/kb-source/libreria-tmwe.md`)
- 1 DAL (`src/data/harmonizeRuns.ts`)
- 1 prompt (`src/v2/agent/prompts/core/harmonizer-briefing.ts`)
- 4 hook in `src/v2/ui/pages/prompt-lab/hooks/`: `harmonizeCollector.ts`, `harmonizeAnalyzer.ts`, `harmonizeExecutor.ts`, `useHarmonizeOrchestrator.ts`
- 2 componenti UI: `HarmonizeSystemDialog.tsx`, `HarmonizeReviewPanel.tsx`
- Bottone in `PromptLabPage.tsx`

Stima: ~1500 righe nuove, zero modifiche a file esistenti tranne `PromptLabPage.tsx` (aggiunta bottone).
