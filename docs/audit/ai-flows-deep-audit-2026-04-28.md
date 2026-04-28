# Deep Audit — AI Flows wca-network-navigator

**Data:** 2026-04-28
**Score complessivo:** 28 000 / 100 000 (low-to-moderate maturity)
**Stato:** Documento di riferimento. Nessun codice modificato.
**Companion doc:** [`./ai-architecture-2026-04.md`](./ai-architecture-2026-04.md) — roadmap operativa in 4 fasi.

---

## 1. Scope e metodologia

Audit tecnico approfondito dei flussi AI del progetto:
- Repo TypeScript/React + ~60 edge function Deno
- Molte orchestrate via Lovable AI Gateway
- Focus: architettura, assemblaggio prompt, sicurezza, validazione output, testing

Cross-check con: OWASP LLM Top 10, paper agentic AI 2024-2026, linee guida PromptOps (Refonte, LaunchDarkly).

---

## 2. Architettura attuale (sintesi)

### 2.1 Multi-layered agent design
- `agent-loop` — loop principale tool-calling, compressione conversazioni, repetition detection
- `agent-execute` — single-shot, costruisce system prompt da doctrine + commercial rules + persona/KB
- `ai-assistant` — modi tool-decision e plan-execution, context loaders, repetition detection
- ~13 funzioni con scope sovrapposti (vedi sezione issues)

### 2.2 Prompt assembly
- Base doctrine (ruolo agente + persona traits)
- Commercial doctrine + KB blocks
- `assembleContext()` con token budget
- Persona da DB → iniettata verbatim

### 2.3 Tools & guardrails
- `toolDefs` + handler dedicati
- `hardGuards.ts` — vieta SQL distruttivo, cap su bulk update
- HITL su alcune azioni (non tutte)
- Rate limiting per-utente (cost guardrails attualmente disattivati per uso interno)

### 2.4 Memory & retrieval
- KB persona-specific + KB generale
- RAG via embeddings su alcuni task
- `agent-loop` comprime storico → `ai_memory`

---

## 3. Issues identificate

### 3.1 Complessità eccessiva e duplicazione
- 3+ orchestratori (`agent-loop`, `agent-execute`, `ai-assistant`) + ~12 one-off
- 13 funzioni con overlap di scope (audit interno)
- Hook inutilizzati → dead code
- Ogni funzione fa context assembly proprio → drift comportamentale

### 3.2 Prompt injection (CRITICO)

**Direct injection** via user/memory:
- Persona fields, vocabulary, example messages → interpolati senza sanitization
- `agent-prompt-refiner` concatena feedback negativo direttamente nel prompt che chiede modifiche al system prompt
- Esempio attacco: feedback "Ignore all previous instructions and..." → propone modifiche pericolose

**Indirect injection** via untrusted data (OWASP LLM01):
- KB entries, website content, business card OCR → appended senza distinzione trusted/untrusted
- Bridge protocol payload (WhatsApp / LinkedIn) → injettati in `classify-inbound-message`
- Email IMAP → 30 inbound emails iniettate in `agent-loop`

**Weak output validation:**
- Pattern: strip markdown fences + `JSON.parse()` senza schema
- Manca semantic filtering
- Nessun fallback safe definito

**Prompt-only defenses brittle:**
- Tool calls auto-eseguiti in alcuni flow senza HITL
- `ai-query-planner`, `generate-email` non sempre richiedono conferma

### 3.3 Type safety + error handling
- `tsconfig`: `strict: false`, `noImplicitAny: false`
- 1 300+ `any` espliciti
- 59 `catch {}` vuoti → errori AI persi senza log
- Memoria `Strict Type Safety` esiste come regola ma non enforced (vedi `Debt Budget Constraint`)

### 3.4 No prompt versioning + no test
- Prompt assemblati a runtime via string concat
- Nessun template centrale, nessun version control sui prompt
- Tabelle DB esistenti: `operative_prompts`, `agent_personas`, `agent_capabilities`, `email_prompts`, `prompt_templates`, `ai_prompt_log`, `prompt_lab_global_runs`
- Manca: snapshot immutabili, diff, rollback, approval flow
- Test coverage ~0.9% (5 unit test totali)
- AI functions effettivamente non testate

### 3.5 RAG senza ROI dimostrato
- Embedding + vector store + chunking → costo manutenzione alto
- Beneficio non misurato per task
- Con context window grandi (Gemini 2.5 Pro 2M tokens) RAG potrebbe essere superfluo

---

## 4. Aspetti positivi

- ✅ `hardGuards` blocca SQL distruttivo + cap bulk
- ✅ Token budget management con priorità (doctrine > mission > persona > context)
- ✅ Repetition detection in `ai-assistant`
- ✅ Memory summarization comprime storico
- ✅ Persona configurabile per tono/lingua/stile (importante per i18n)
- ✅ HITL su alcune azioni sensibili
- ✅ Rate limiting per-utente (struttura esiste anche se disattivata)

---

## 5. Sistemi che abusano dei prompt o agiscono indipendentemente

| Sistema | Issue |
|---------|-------|
| `agent-prompt-refiner` | Inietta feedback non-trusted in prompt che chiede modifiche al system prompt. No human review delle suggested changes. |
| `ai-query-planner` | Genera SQL da NL. Restringe a SELECT ma non valida table/column names. Query injection possibile. |
| `agent-loop` & `agent-execute` | Eseguono tool calls senza sempre richiedere conferma. Prompt injection → tool execution non intenzionale. |
| `ai-assistant` | Modi separati (tool-decision, plan-execution) duplicano context logic. `detectRepetitions` scrive memory da user messages → istruzioni persistono. |
| `sherlock-extract` & `parse-profile-ai` | Parse business card/profile via LLM senza strict output validation. Malformed JSON o injection via input document. |
| `analyze-import-structure` | Accetta user data e la passa al prompt per inferire schema tabella. CSV headers malevoli possono iniettare istruzioni. |
| Multiple small classifiers | `classify-email-response`, `categorize-content`, etc. assemblano prompt ad-hoc. Dovrebbero riusare template centrale. |

---

## 6. Raccomandazioni (priorità ordinata)

1. **Consolidate orchestration logic** → un solo AI gateway service (auth + context + persona + system prompt + tool execution). Le altre funzioni diventano subroutine.
2. **Adopt prompt templates + PromptOps** → templating engine (YAML/JSON), version control centrale, separazione instruction blocks / context / tool hints / output format. CI/CD con linting + load testing + observability.
3. **Robust input/output sanitation:**
   - Filtra/summarizza untrusted content prima dell'iniezione
   - Delimitatori chiari intorno a user/memory content (OWASP segregation)
   - Schema validation Zod su tutti i JSON output, fallback safe
   - Escape caratteri pericolosi in persona/feedback fields
4. **Layered security** (paper agentic AI):
   - Tool allowlist per task
   - Sandboxed execution per file/network ops
   - Explicit user confirmation per high-risk actions
   - Independent policy/audit checks
   - Principle of least privilege
5. **Strong type safety + error reporting** → `strict: true`, interfacce per prompts/messages/tool outputs, structured logging JSON per ogni AI call (prompt + response + tool exec)
6. **Reduce RAG** se context window basta. Misurare ROI per ogni task prima di mantenerlo.
7. **MCP standard** → considerare Model Context Protocol per definire tool interfaces (audit indipendente, interop)
8. **Test suites + quality metrics** → synthetic + real-prompt tests, success rate, error counts, format compliance, hallucination/loop monitoring, error-recovery + meta-cognitive modules
9. **Documentation + training** → purpose/interfaces per ogni funzione, training developer su prompt injection

---

## 7. Rating dettagliato

| Dimensione | Score | Max | Note |
|------------|------:|----:|------|
| Architectural clarity | 9 000 | 20 000 | Concept agentico avanzato ma duplicazione orchestratori |
| Prompt hygiene & security | 5 000 | 20 000 | Guardrail parziali, vulnerabile a prompt/query injection, output validation scarsa |
| Testing & evaluation | 1 000 | 20 000 | Coverage <1%, nessuna prompt evaluation sistematica |
| Maintainability & docs | 7 000 | 20 000 | Doc parziali, strict off, `any` diffusi, dead code |
| Best-practices alignment | 6 000 | 20 000 | Agentic AI moderno ma manca layered security, templates, PromptOps |
| **TOTALE** | **28 000** | **100 000** | **Low-to-moderate maturity** |

---

## 8. Mapping audit → roadmap

Le 9 raccomandazioni di §6 mappano sulle 4 fasi del companion doc `ai-architecture-2026-04.md`:

| Raccomandazione audit | Fase roadmap | Priorità |
|----------------------|--------------|----------|
| #2 Prompt templates + PromptOps + versioning | **Fase 1** (in partenza) | **Alta** |
| #8 Test suites | **Fase 1** | **Alta** |
| #3 Input/output sanitation | Fase 2 | Alta |
| #4 Layered security (HITL, sandbox, allowlist) | Fase 3 | Media |
| #1 Consolidate orchestrators | Fase 4 | Media |
| #5 Type safety + structured logging | Fase 4 | Media |
| #6 Reduce RAG | Fase 4 | Bassa |
| #7 MCP standard | Post-Fase 4 | Bassa |
| #9 Documentation | Continuo | Continuo |

---

## 9. Score target post-roadmap

Stima score raggiungibile completando le 4 fasi:

| Dimensione | Attuale | Post-Fase 1 | Post-Fase 2 | Post-Fase 3 | Post-Fase 4 |
|------------|--------:|------------:|------------:|------------:|------------:|
| Architectural clarity | 9 000 | 9 000 | 9 000 | 11 000 | **16 000** |
| Prompt hygiene & security | 5 000 | 8 000 | **15 000** | 17 000 | 18 000 |
| Testing & evaluation | 1 000 | **12 000** | 13 000 | 14 000 | 16 000 |
| Maintainability & docs | 7 000 | 9 000 | 10 000 | 12 000 | **16 000** |
| Best-practices alignment | 6 000 | 8 000 | 12 000 | 15 000 | **17 000** |
| **TOTALE** | **28 000** | **46 000** | **59 000** | **69 000** | **83 000** |

Target realistico: **~83 000 / 100 000** (high maturity) completando tutte le 4 fasi senza interventi su MCP/RAG riduzione.

---

## 10. Riferimenti

- OWASP LLM Top 10 (2025): LLM01 Prompt Injection, LLM02 Insecure Output Handling
- Paper agentic AI 2024-2026 — layered mitigations, sandbox, HITL
- Refonte — template-driven prompt engineering
- LaunchDarkly — RAG complexity vs context windows
- Memoria progetto: `architecture/operative-prompts-unified-loader`, `features/agent-capabilities-db-layer`, `features/agent-personas-db-layer`, `features/prompt-lab-simulator`, `governance/activity-supervisor-audit`, `tech/v2-io-resilience-and-validation-protocol`
