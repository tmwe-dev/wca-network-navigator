# Piano: Memorizzazione Audit Prompt Lab + Estrazione Know-How da RadioChat

## Fase 1 — Memorizzare audit Prompt Lab corrente (TMWE)

Salvare in memoria persistente:

1. **`mem://reference/prompt-lab-audit-2026-05-11.md`** — snapshot audit 62/100:
   - 4 macro gruppi × 20+ tab in `PromptLabPage.tsx`
   - Sister pages: `/atlas`, `/catalog`, `/tests`, `/proposals`, `/suggestions`, `/agent/:slug`
   - 7 agenti improvement: prompt-copilot-chat, agent-prompt-refiner, Architect, prompt-test-runner, refine-classification-rule, prompt-registry-drift-check, Harmonizer
   - DB state: 136 operative_prompts (54 distinct), 249 kb_entries, 8 personas vuote, 270 versions, 17 test cases, 0 runs 30d
   - 3 loop rotti: refiner senza cron, test runner inattivo, personas vuote

2. **`mem://standards/prompt-lab-improvement-roadmap.md`** — roadmap P0-P3:
   - P0: cron refiner + dedup operative_prompts (136→54) + banner Suggestions
   - P1: popolare 8 personas (min 300 char) + schedule prompt-test-runner
   - P2: coverage test 31%→70% + refactor doctrine KB (120/249)
   - P3: dashboard "Health Prompt Lab"

3. **Update `mem://index.md`** — aggiungere riferimenti.

## Fase 2 — Estrazione know-how da `tmwe-dev/radiochat`

Clonare il repo in `/tmp/radiochat` e analizzare in profondità:

### 2.1 — Inventario tecnico
- Struttura: `src/`, `api/`, `prompts/`, `agents/`, KB
- Identificare file di prompt engineering (21 strati dichiarati)
- Mappare i 4 agenti (Albert/Archimede/Pitagora/Newton) e personalità
- Sistema di micro-agenti paralleli (3 nel modulo didattico)
- Knowledge Base con pattern matching e context tags
- Anti-pattern espliciti per naturalezza
- Phase engine (setup → analysis → debate → synthesis → deliverable)
- Memory hierarchy 3 livelli (full → condensed → summary)
- Proxy AI unificato 4 provider

### 2.2 — Analisi comparativa con TMWE
Per ciascun pattern trovato, valutare:
| Pattern RadioChat | Già in TMWE? | Riusabile? | Dove integrare |
|---|---|---|---|
| 21-layer prompt builder | No | ✅ promptParts.ts | `_shared/prompts/` |
| 4 personas dibattito | No (8 vuote) | ✅ Architect/Director/Refiner/Harmonizer | `agent_personas` DB |
| Micro-agenti paralleli | No | ✅ classify-email-response | edge function |
| Phase engine | Parziale (Sherlock) | ✅ campaigns | outreach |
| Memory hierarchy | Sì (L1-L3) | Confronto | doctrine governance |
| Anti-pattern naturalezza | No | ✅ journalistReview | editorial layer |
| KB pattern matching | Sì | Confronto | kb_entries |
| Convergence routing | No | ✅ command orchestrator | new |

### 2.3 — Estrazione contenuti riusabili
- Prompt completi dei 4 agenti (per popolare le 8 personas vuote in TMWE)
- Anti-pattern catalog (per editorial layer)
- Frasi chiave / regole tono
- Schema KB injection contestuale
- Logica convergenza panel multi-agente
- Phase decomposition templates

### 2.4 — Memorizzazione strutturata
Salvare in:
- `mem://reference/radiochat-extract-2026-05-11.md` — inventario completo + tabella confronto
- `mem://standards/multi-agent-debate-pattern.md` — pattern panel + convergenza riusabile
- `mem://standards/anti-pattern-naturalness-catalog.md` — regole anti-naturalezza
- `mem://standards/21-layer-prompt-builder.md` — schema layer per layer
- `mem://reference/personas-seed-from-radiochat.md` — testi sorgente per popolare `agent_personas`

### 2.5 — Audit finale di gap/azioni concrete
Documento `/mnt/documents/radiochat-vs-tmwe-gap-analysis.md` con:
- Cosa importare subito (quick wins)
- Cosa richiede adattamento
- Cosa scartare (es. localStorage, chiavi esposte, no TS — già risolti in TMWE)
- Roadmap integrazione 3 sprint

## Fase 3 — Verifica passo-passo (interattiva)

Dopo Fase 2, presentare al utente:
1. Tabella confronto pattern-by-pattern
2. Selezione interattiva (questions tool) di cosa portare in produzione
3. Per ogni elemento approvato → creare task atomico

## Dettagli tecnici

- Clone: `git clone https://github.com/tmwe-dev/radiochat.git /tmp/radiochat --depth=1`
- Analisi: `rg`/`code--list_dir` per mappare struttura
- Lettura mirata file prompt/agents/KB
- Nessuna modifica al codice TMWE in questa fase — solo lettura + memorizzazione
- Zero refactor, zero side-effect su edge functions o DB

## Out of scope
- Implementazione integrazioni (rimandata a sprint successivi)
- Modifiche a operative_prompts o agent_personas (richiede approvazione esplicita)
- Toccare nodi critici (orchestratori, send-email, classify) senza mappa impatto

## Output finali
1. 5+ memory files persistenti
2. Documento gap analysis in `/mnt/documents/`
3. Tabella decisionale per Fase 3 interattiva