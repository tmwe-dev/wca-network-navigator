# Piano — Prompt Reader collaborativo + KB Index Map

## Parte 1 — Lettura della guida COBRA (parere d'uso)

La guida è ottima e **coerente al 90%** con l'ADR 0004 appena salvato. Tre raffinamenti rispetto a quello che già abbiamo:

**Da adottare integralmente**
- Prompt come **artefatto a blocchi** (`role / mission / constraints / tools / workflow / output_format / examples / refusal_policy`). Più granulare del nostro attuale 5-sezioni (Identità/Obiettivo/Metodo/Guardrail/Output). Compatibile: i nostri 5 blocchi sono mappabili 1:1 sui blocchi COBRA.
- Quattro ruoli AI separati e non fondibili: **Architect** (diagnosi, no scritture) → **Editor** (modifica chirurgica un blocco) → **Global Improver** (raro, alto rischio) → **Test Runner + Evaluator** (deterministico). Già parzialmente nel nostro Prompt Lab ma non separati come ruoli.
- Regola di approvazione: `candidate_score ≥ active_score AND candidate_score ≥ 80 AND no blocking failures`.

**Da adattare al nostro contesto (non da copiare letteralmente)**
- Schema dati: la guida propone `agents/prompt_versions/prompt_blocks/golden_inputs/rubrics/test_runs/evaluations/...`. Noi abbiamo già `operative_prompts`, `prompt_versions`, `prompt_test_cases`, `prompt_test_runs`, `agent_personas`, `agent_capabilities`, `kb_entries`. Da ADR 0004: tutto va racchiuso in **runtime_bundles** (prompt+persona+KB snapshot+capabilities+routing+guards+model+temp). La guida COBRA non versiona il bundle, solo il prompt → la nostra ADR 0004 è più severa, va tenuta.
- Edge functions: la guida propone `architect-analyze / build-prompt-from-blocks / test-run-batch / evaluate-run / deploy-version / rollback-version`. Da unificare nel **Prompt Change Kernel** unico (ADR 0004) che orchestra le sotto-fasi internamente — evita 6 endpoint indipendenti che bypassano la governance.
- Anti-pattern: i 5 della guida coincidono con i nostri.

**Da NON copiare**
- Il file-system per blocchi (`role.md`, `mission.md`…). Da noi i blocchi vivono in tabelle (`operative_prompts.context/objective/procedure/criteria/examples`), non su filesystem. Manteniamo DB-first.

→ La guida COBRA viene allegata come complemento operativo all'ADR 0004 (`docs/adr/0004-prompt-governance-runtime-bundle.md → riferimento a docs/governance/cobra-blocks-and-roles.md`). Nessuna modifica alle fondazioni.

---

## Parte 2 — Prompt Reader collaborativo (cosa cambia in UI)

Layout attuale `/v2/prompt-reader`: sidebar agenti a sinistra + testo prompt assemblato al centro + sezione KB sotto + bottoni download.

Layout target: **3 colonne**.

```text
┌─────────────┬───────────────────────────┬───────────────────┐
│  Sidebar    │  Prompt assemblato        │  Co-pilot Chat    │
│  Agenti     │  (blocchi cliccabili)     │  (AI ↔ KB)        │
│  (esistente)│                           │                   │
│             │  ▸ Identità  [seleziona]  │  Tu: migliora il  │
│             │  ▸ Obiettivo              │  blocco Identità  │
│             │  ▸ Metodo                 │                   │
│             │  ▸ Guardrail              │  AI: leggo KB     │
│             │  ▸ Output                 │  [doctrine, …]    │
│             │  ▸ Persona                │  Diff proposto:   │
│             │  ▸ Capabilities           │  - vecchio        │
│             │  ▸ KB iniettata           │  + nuovo          │
│             │                           │  [Crea CR] ¹      │
└─────────────┴───────────────────────────┴───────────────────┘
```

¹ "CR" = `change_request` registrata nel sistema (NON deploy diretto). Rispetta ADR 0004: la chat **non scrive sul prompt attivo**, produce solo proposte.

**Comportamenti chat**
- Click su un blocco del prompt → la chat lo riceve come "blocco target" (replica del pattern Editor della guida COBRA).
- L'utente scrive cosa migliorare. L'AI:
  1. Carica le KB pertinenti tramite la **KB Index Map** (Parte 3).
  2. Mostra esplicitamente quali entry KB ha letto (chip cliccabili).
  3. Propone un diff sul blocco (testo originale → testo nuovo) + motivazione + rischi + assunzioni (output Editor della guida).
  4. Pulsante "Crea Change Request" → scrive in tabella `change_requests` (per ora `prompt_change_proposals`, schema minimo, vedi Parte 4).
- Tab secondaria "Aggiungi materiale alla KB":
  - Incolla testo / URL / file → AI lo analizza, propone categoria + chapter + tags + priorità + se duplica/conferma/contraddice entry esistenti.
  - Pulsante "Crea proposta KB" → scrive in `kb_entry_proposals` (status pending, mai diretto in `kb_entries`).

**Vincoli da rispettare**
- Charter: chat passa da `invokeAi()` con `scope='lab'` e `context.source='prompt-reader-copilot'`.
- DAL only: nuove query in `src/data/promptChangeProposals.ts` e `src/data/kbProposals.ts`.
- UI logic-less: state e business in hook `usePromptCopilot.ts`.
- Editorial review NON si applica (non è messaggio commerciale).

---

## Parte 3 — KB Index Map (il documento richiesto)

Obiettivo: dare all'AI una **mappa navigabile** delle KB invece di farle leggere 167 entry ogni volta. Due artefatti:

**A) Documento markdown statico** `docs/governance/kb-index-map.md`
- Una sezione per ogni **categoria canonica** (6, già definite nell'audit del 2026-05-02): `doctrine`, `procedures`, `personas`, `playbooks`, `glossary`, `data-schema`.
- Per ogni categoria: scopo, quando usarla, esempi di domande che la KB risolve, agenti che la consumano (incrocio con `kbCategories` del registry).
- Una sezione "decision tree": dato un intento ("validare un blocco Identità", "verificare regola commerciale", "controllare schema DB"), quale categoria/chapter consultare.
- Tabella inversa "agente → KB": per ciascun agente attivo, lista delle KB iniettate ordinate per priorità.

**B) Endpoint runtime** `kb-index-map` (edge function read-only)
- Restituisce JSON strutturato: `{categories:[{key, purpose, chapters:[…], agents_using:[…], avg_priority}], agent_to_kb:{agent_slug:[entry_id…]}, intent_routing:{intent:[category…]}}`.
- Generato on-demand da `kb_entries` (no duplicazione dati). Cache 10 min.
- Consumato dalla chat copilota: prima di proporre un diff l'AI chiama `kb-index-map`, decide quali entry leggere, poi `findKbEntries({ids})`. Riduce drasticamente i token.
- Esposto anche nella UI come tab "Mappa KB" del Prompt Reader (per ispezione umana).

---

## Parte 4 — Schema dati minimo (solo nuove tabelle, nessuna modifica a quelle esistenti)

Coerente con ADR 0004 ma intermedio: pone le basi senza implementare ancora il Runtime Bundle completo.

```sql
-- Proposte di modifica prompt (output della chat copilota)
prompt_change_proposals (
  id, prompt_id, block_name, source_tool, status,
  current_content, proposed_content, diff,
  rationale, risks, assumptions,
  kb_entries_consulted uuid[],   -- audit trail
  created_by, created_at
)

-- Proposte di nuovo materiale KB
kb_entry_proposals (
  id, source ('paste'|'url'|'file'), raw_content,
  suggested_category, suggested_chapter,
  suggested_title, suggested_tags, suggested_priority,
  conflicts_with uuid[], duplicates_of uuid,
  status, created_by, created_at,
  approved_kb_entry_id  -- popolato dopo approval
)
```

RLS: lettura globale operatori autenticati, scrittura legata a `auth.uid()`. No DELETE fisico (soft-delete via trigger esistente).

---

## Parte 5 — Edge functions (3 nuove)

1. `prompt-copilot-chat` — chat streaming. Riceve `{agent_id, block_name?, messages, mode:'edit'|'kb_intake'}`. Carica KB tramite `kb-index-map`, restituisce risposta + (opzionale) diff strutturato + lista entry consultate. **Mai deploy**, mai scrittura diretta su prompt.
2. `kb-index-map` — read-only, restituisce la mappa JSON descritta in Parte 3.
3. `kb-intake-analyze` — riceve raw content, restituisce suggerimento categoria/chapter/duplicati/conflitti. Usato dalla tab "Aggiungi materiale".

Tutte e tre passano da `_shared/operativePromptsLoader.ts` per i loro system prompt (editabili da Prompt Lab, no hardcode).

---

## Parte 6 — Ordine di implementazione

| # | Step | Effort |
|---|------|--------|
| 1 | Migration `prompt_change_proposals` + `kb_entry_proposals` + RLS | S |
| 2 | DAL `promptChangeProposals.ts` + `kbProposals.ts` | S |
| 3 | Documento `docs/governance/kb-index-map.md` (statico) | S |
| 4 | Edge `kb-index-map` (read-only) + DAL | M |
| 5 | Edge `prompt-copilot-chat` (streaming, scope=lab) | M |
| 6 | Edge `kb-intake-analyze` | S |
| 7 | UI 3-colonne in `PromptReaderPage` con tab Chat / Mappa KB / Aggiungi KB | M |
| 8 | Hook `usePromptCopilot` + componenti `BlockSelector`, `DiffPreview`, `KbConsultedChips`, `KbIntakeForm` | M |
| 9 | Pagina `/v2/prompt-lab/proposals` per review proposte (lista + accept/reject) | M |
| 10 | Memoria `mem://features/prompt-copilot-and-kb-index` | XS |

---

## Cosa **NON** è in questo piano (rimandato)

- Runtime Bundle completo, Change Kernel unificato, Rubric Engine, Coverage Matrix → restano nell'ADR 0004 come fasi successive.
- Auto-approval delle change request → manuale finché non c'è il Rubric Engine.
- Migrazione degli altri tool del Prompt Lab al kernel → fase 3 dell'ADR.

## Definition of Done di questo piano

1. Da `/v2/prompt-reader` posso selezionare un blocco e chiedere all'AI di migliorarlo.
2. La risposta mostra esplicitamente quali KB ha consultato (chip cliccabili).
3. Posso salvare la proposta come `change_request` (review separata).
4. Posso incollare nuovo materiale e l'AI propone categoria/chapter/duplicati.
5. Il documento `kb-index-map.md` esiste e l'endpoint runtime restituisce JSON coerente.
6. Nessuna scrittura diretta su `operative_prompts` o `kb_entries` da parte della chat.
