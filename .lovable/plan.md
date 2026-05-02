## Cosa fa swiftpack-studio (gestione listini) — pattern per attività progressive

Ho letto il repo [tmwe-dev/swiftpack-studio](https://github.com/tmwe-dev/swiftpack-studio). È un caso da manuale di "agente con job persistenti, agenda, e ripresa stato". Ecco il pattern, poi come applicarlo al nostro Command.

### 1. Le 4 colonne del loro sistema

**A. Job persistente (`import_jobs` + `import_documents`)**
- Ogni file caricato apre un **job** in DB con `status` (`uploaded` → `analyzing` → `analyzed` → `committing` → `committed` / `error`) e un **owner** (`user_id`).
- Tutto il lavoro avanza modificando record DB, mai stato in RAM. Refresh pagina = nessuna perdita.

**B. State machine formale (`gate-machine.ts`)**
- 7 "Gate" numerati 0→6 (Ricezione, Comprensione, Estrazione, Validazione, Correzione, Costruzione, Commit).
- Ogni gate ha: `name`, `description`, `kbTags` (KB caricata SOLO per quel gate), `exitCriteria` (verificabili deterministicamente).
- Transizioni controllate da una funzione pura: si avanza **solo** se gli exit criteria sono soddisfatti. Si può tornare indietro.
- L'AI sa sempre "in che gate sono", "cosa mi manca per uscire", "cosa caricare di KB".

**C. Coda lavori visibile all'operatore (`WorkQueue` + `useImportQueue`)**
- Lista laterale con tutti i job dell'utente, badge stato, conteggio completati, file attivo.
- Concorrenza limitata (`MAX_CONCURRENT = 1`) → sa che sta lavorando su X mentre Y, Z sono in coda.
- Ripresa nativa: clicchi un job vecchio → riapre esattamente nel gate dove era.

**D. Doppia modalità di interazione (`GuidedWizard` + `ImportChat`)**
- **Wizard guidato**: AI fa domande mirate al gate corrente (`QuestionCard`), utente risponde, AI avanza.
- **Chat libera**: utente può sempre passare a chat per intervento manuale; gli stessi tool del wizard sono esposti come function calls.
- **Auto-pilot** (`useAutoPilot`): se trova un template simile usato ≥2 volte con confidenza >0.8, risponde lui alle domande senza chiedere → impara dai job precedenti.
- **Audit log** (`AuditPanel`, `audit-logger.ts`): ogni decisione AI loggata con motivazione → l'operatore vede *perché* ha scelto.

### 2. Pezzi tecnici importanti

| File | Cosa fa |
|---|---|
| `gate-machine.ts` | SSOT degli stati, transizioni, exit criteria, KB tags per gate |
| `ownership.ts` | Guardie centralizzate `requireOwnedJob`, `requireOwnedDocument`, `requireJobStatus` — ogni handler le chiama |
| `kb-engine.ts` | Carica `loadFullContext` filtrato per `kbTags` del gate → AI non vede KB che non serve |
| `prompt-builder.ts` | System prompt costruito dinamicamente in funzione del gate corrente |
| `chat-tools.ts` | Function calls esposti all'AI (update_document, advance_gate, retreat_gate, commit, …) |
| `commit-engine.ts` + `staging.ts` | Two-phase commit: prima staging in `import_job_rows`, poi commit atomico |
| `import_chat_messages` (DB) | Persistenza completa chat per documento → riapri job, ritrovi tutta la conversazione |
| `useImportQueue` | Coda con `analyzingCount` + `pendingQueue` + ripresa via DB |
| `useAutoPilot` | Apprendimento da template precedenti |

### 3. Il confronto secco con il nostro Command

| Capacità | swiftpack-studio | nostro Command |
|---|---|---|
| Job persistente in DB | ✅ `import_jobs` | ❌ tutto in RAM |
| State machine formale | ✅ 7 gate con exit criteria | ❌ piano lineare ad-hoc |
| Coda lavori visibile | ✅ `WorkQueue` con stato | ❌ nessun concetto di coda |
| Ripresa job dopo refresh | ✅ nativa | ❌ contesto perso in 5 min |
| Chat persistita per job | ✅ `import_chat_messages` | ⚠️ `command_messages` esiste ma non scriviamo |
| KB filtrata per fase | ✅ tag per gate | ⚠️ KB statica `command_scope` |
| Audit decisioni AI | ✅ `audit-logger.ts` | ❌ assente |
| Auto-pilot da template | ✅ con soglia confidenza | ❌ assente |
| Ownership guards | ✅ centralizzate | ⚠️ sparse |

### 4. Il modello mentale che ci ruba

**"Job = oggetto di prima classe in DB. UI è una vista. AI è un operatore che lavora UN job alla volta dentro una state machine."**

- Niente "memoria conversazionale fragile". Lo stato VIVE nel job.
- L'agenda dell'agente non è un calendario, è la `WorkQueue`: "ho 3 job aperti, attivo è X al gate 2/7".
- Per "iniziare lavori e finirli" basta: `command_jobs` row + `command_job_steps` row + state machine.

### 5. Proposta concreta per il nostro Command (4 fasi)

**Fase 1 — Tabelle e stato persistente**
- `command_jobs` (id, user_id, conversation_id, goal, current_phase, status, created_at, updated_at, last_activity_at, snapshot jsonb).
- `command_job_steps` (job_id, step_number, tool_id, params, result, status, started_at, completed_at, ai_reasoning).
- Wire `useConversation.addMessage` su ogni turno (oggi non viene mai chiamato → la chat NON viene salvata).
- Riprendi `lastQueryResultContext` dal DB quando si riapre una conversazione.

**Fase 2 — State machine command**
- Definire 5-6 fasi tipo gate-machine: `IDLE → DISCOVERY → PLANNING → AWAITING_APPROVAL → EXECUTING → REVIEW → DONE`.
- Ogni fase con `exitCriteria`, `kbTags`, prompt-fragment dedicato.
- `planRunner` diventa un trasduttore di gate, non un esecutore lineare.

**Fase 3 — WorkQueue per il Command**
- Sidebar con job aperti dell'operatore + badge fase corrente + età (come `WorkQueueV2.tsx` di loro).
- Tool nuovo `myJobs` che il planner consulta automaticamente prima di rispondere → "hai 2 job in pausa, riprendi o nuovo?".
- Concorrenza configurabile (loro 1, noi forse 3 per multi-thread).

**Fase 4 — Auto-pilot + Audit + KB filtrata**
- `command_job_templates` con casi ricorrenti ("invito partner per evento", "scoperta partner in città X") → auto-completion delle scelte.
- Audit panel a destra che mostra ogni decisione AI con reasoning.
- KB caricata in `ai-assistant` con tag derivati dalla fase corrente del job.

### 6. Da dove partire

Suggerisco l'ordine: **Fase 1 (sblocca il dolore di oggi) → Fase 3 (dà il senso di "agenda") → Fase 2 (rigorizza la macchina) → Fase 4 (intelligenza)**.

Fase 1+3 insieme producono un risultato visibile in mezza giornata: il Command smette di dimenticare, e tu vedi sulla sinistra "i lavori aperti dal direttore" come una vera agenda operativa.

Confermi questa direzione e da quale fase partire?