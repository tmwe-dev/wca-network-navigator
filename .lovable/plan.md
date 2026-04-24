## Obiettivo

Trasformare l'Harmonizer da "indovinatore con prompt monolitico" a "consultatore di documentazione strutturata", separando in 3 strati nettamente distinti: **prompt** (chi è / come ragiona), **KB dedicata** (cosa sa), **contesto runtime** (cosa gli arriva per questo run). Risolvere in parallelo i 5 buchi sostanziali (goal injection, schema awareness, executor agents, parser robusto, loop di chiusura).

## Struttura a 3 strati

```
┌──────────────────────────────────────────────────┐
│ STRATO 1 — PROMPT (700-900 token, immutabile)     │
│ Identità, ragionamento, output schema, routing KB│
├──────────────────────────────────────────────────┤
│ STRATO 2 — KB HARMONIZER (10 file .md in RAG)    │
│ Schema DB, enum, dominio, costituzione, esempi   │
├──────────────────────────────────────────────────┤
│ STRATO 3 — CONTESTO RUNTIME (iniettato per run)  │
│ Goal utente, inventario, gap chunk, KB recuperata│
└──────────────────────────────────────────────────┘
```

## Decisione preliminare obbligatoria

**Vocabolario campi**: nel prompt nuovo concordato l'utente usa `action_type`, `impact_score`, `severity`, `test_urgency`, `block_name`. Il codice attuale usa `action`, `impact`, `block_label`. Decisione adottata: **migrazione completa al vocabolario nuovo**, perché più espressivo (impact 1-10 vs low/medium/high, severity separata da impact_score, ecc.). Questo richiede aggiornamento coordinato di prompt + tipo + parser + executor + UI di review.

---

## Lavoro 1 — Creare la KB Harmonizer (10 file)

Tutti in `public/kb-source/harmonizer/`. Sono `.md` letti dal RAG per nome.

1. `00-context-wca.md` — Cos'è WCA Network Navigator, le 17 reti, ruoli operatori, glossario (partner, contact, mission, outreach, agent, persona, holding pattern), pipeline lead a 9 stati come diagramma testuale.
2. `10-action-examples.md` — 1 esempio canonico per ciascuna delle 4 azioni + 2-3 anti-esempi ("sembrava UPDATE ma era INSERT").
3. `20-truth-hierarchy.md` — Gerarchia di verità con casi reali del WCA Network Navigator (esempi presi da `hardGuards.ts`, da `mem://constraints/*`, dai prompt core).
4. `30-business-constraints.md` — Lista esatta dei 9 stati lead, lista tabelle business protette (contacts, partners, activities, channel_messages, campaigns, missions), tabelle backend riservate, Costituzione commerciale in 10 punti.
5. `40-agents-schema.md` — Schema completo della tabella `agents` (estratto via query: id, name, role, system_prompt, knowledge_base, assigned_tools, territory_codes, can_send_email, daily_send_limit, ecc.) + relazione con `agent_personas`.
6. `41-agents-existing.md` — File **generato runtime** dal collector ad ogni run: snapshot agenti attivi con territori, persona, tool. Non scritto a mano.
7. `50-kb-categories.md` — Enum esatti di `kb_entries.category`, cosa va in ciascuna, convenzioni `chapter`, range `priority`.
8. `60-code-policies-active.md` — Estratto da `src/v2/agent/policy/hardGuards.ts` + memoria `mem://constraints/*`: lista policy hard già implementate. Per ciascuna: nome, file, vincolo. Regola: se gap richiede una di queste → `resolution_layer = code_policy`.
9. `70-runtime-contracts.md` — EmailBrief, VoiceBrief, ContactLifecycleBrief, OutreachBrief: schema, dove vivono, contratti mancanti noti. Regola: se gap richiede campo non in nessuno → `resolution_layer = contract`.
10. `80-resolved-cases.md` — Memoria storica auto-aggiornata: 10-15 gap risolti con before/after/decisione. Ogni proposta approvata aggiunge un caso (loop di apprendimento, implementato in Lavoro 5).

## Lavoro 2 — Riscrivere il prompt (`harmonizer-briefing.ts`)

Sostituire integralmente con la nuova versione strutturata in 8 sezioni brevi:
- **A** Identità e missione (5 righe)
- **B** Le 4 azioni e i 4 resolution_layer (definizioni secche)
- **C** Gerarchia di verità non negoziabile (4 punti, 1 riga ciascuno)
- **D** Regole di disambiguazione UPDATE/INSERT/MOVE (dalla v2 concordata)
- **E** Guard-rail duri (lista, riferimenti a KB per dettagli)
- **F** Routing alla KB Harmonizer (mappa esplicita: "per X consulta documento Y")
- **G** Schema di output JSON puro (vocabolario nuovo)
- **H** Vincolo finale + fallback `{"proposals": []}`

Target: 700-900 token totali. Tutto ciò che è "elenco di valori" o "esempio lungo" rimosso e migrato in KB.

## Lavoro 3 — Allineare tipi, parser, executor al vocabolario nuovo

**File da toccare**:
- `src/data/harmonizeRuns.ts` — `HarmonizeProposal` riallineato: `action_type`, `target_type` (enum esteso con `system_prompt_block`, `readonly_note`), `severity`, `impact_score: 1-10`, `test_urgency`, `current_location`, `proposed_location`, `current_issue`, `proposed_content`, `evidence: [...]` (array), `required_variables`, `missing_contracts`, `apply_recommended`, `block_name`. Mantenere campo `dependencies` invariato.
- `src/v2/ui/pages/prompt-lab/hooks/harmonizeAnalyzer.ts` — Nuovo parser robusto con validazione **Zod** dello schema output. Se il modello sbaglia un campo, errore visibile invece di `[]` silenzioso. Logging visibile dei chunk falliti.
- `src/v2/ui/pages/prompt-lab/hooks/harmonizeExecutor.ts` — Mappatura `target_type` → tabella DB. Implementazione completa di `agents` (INSERT + UPDATE) e `app_settings` (oggi sono stub). Mappatura `system_prompt_block` → `app_settings`, `readonly_note` → skip + registrazione in nuova tabella `harmonizer_followups`.
- `src/v2/ui/pages/prompt-lab/HarmonizeReviewPanel.tsx` — Adattamento UI ai campi nuovi (impact_score 1-10, severity badge separato, test_urgency, dependencies cablati: bottone Approva di B disabilitato finché A non approvata).

## Lavoro 4 — Iniezione goal + contesto + KB nel runtime

**File da toccare**: `src/v2/ui/pages/prompt-lab/hooks/harmonizeAnalyzer.ts` + `harmonizeCollector.ts`

- `buildUserPrompt` riceve e inietta nel system message: **goal utente**, **operatore corrente** (id, ruolo, country), **modalità** (first_run / delta / review_riaperta), **lingua**.
- Collector arricchito: per ogni chunk fa **retrieval mirato** dei doc KB rilevanti (es: chunk con gap su `agents` → carica `40-agents-schema.md` + `41-agents-existing.md`) e li passa al modello come blocco "REFERENCES" nel user message.
- Generazione runtime di `41-agents-existing.md` ad ogni run dal collector.

## Lavoro 5 — Loop di chiusura e follow-up

**Migrazione DB**: nuova tabella `harmonizer_followups` per registrare proposte `resolution_layer in ('contract','code_policy')` come note sviluppatore tracciabili (oggi finiscono solo nell'audit log e si perdono).

**Modifiche codice**:
- Executor: ogni proposta su `agents` o `agent_personas` eseguita genera un `agent_task` di tipo "verifica comportamento post-armonizzazione" assegnato all'operatore corrente.
- Executor: ogni proposta `executed` con esito `ok` aggiunge un caso a `80-resolved-cases.md` (append automatico via edge function dedicata o via supabase storage, da decidere in implementazione).

## Lavoro 6 — Verifica delle 2 cose segnalate dal commentatore

- **Verifica `dependencies` UI**: oggi `HarmonizeReviewPanel` mostra solo "Dipendenze: N", non disabilita i bottoni in catena. Cablare in `useHarmonizeOrchestrator.toggleApproval` la regola: una proposta con `dependencies` non approvabile finché tutte le sue dipendenze non sono in `approvedIds`.
- **Verifica `contract_status: missing`**: confermato che oggi `executeProposal` skippa `resolution_layer === "contract"`. Ma `missing_contracts: [...]` viene perso. Lavoro 5 risolve registrandolo in `harmonizer_followups`.

---

## Dettagli tecnici

**Stack**: invariato. React 18 + Vite + Supabase. Validazione output: Zod.

**Edge function**: nessuna nuova. Riusiamo `unified-assistant` con il briefing aggiornato. Il RAG è già in piedi sui file `public/kb-source/`, basta che i nuovi `.md` rispettino la convenzione di indicizzazione.

**Tabella nuova `harmonizer_followups`**: id, run_id, proposal_id, layer (contract|code_policy), title, description, missing_contracts (jsonb), code_policy_needed (text), severity, status (open|in_progress|resolved|wont_fix), assigned_to, created_at, resolved_at. RLS: visibile a tutti gli operatori (i follow-up sono shared, come la KB).

**Backward compatibility**: il vocabolario campi cambia. I run vecchi su `harmonize_runs` con il vecchio schema `proposals` restano leggibili ma non eseguibili (la UI mostra un badge "schema legacy"). Nessuna migrazione retroattiva dei dati.

**Ordine di esecuzione obbligato**:
1. Migrazione DB (tabella `harmonizer_followups`)
2. Creazione 9 file KB statici (tutti tranne `41-agents-existing.md`)
3. Riallineamento tipi (`harmonizeRuns.ts`)
4. Riscrittura prompt (`harmonizer-briefing.ts`)
5. Riscrittura parser + iniezione goal/contesto (`harmonizeAnalyzer.ts`, `harmonizeCollector.ts`)
6. Implementazione executor completa (`harmonizeExecutor.ts`) + generazione runtime `41-agents-existing.md`
7. Adattamento UI review (`HarmonizeReviewPanel.tsx`) con dipendenze cablate
8. Loop di chiusura (agent_task + append a `80-resolved-cases.md`)

## Non fa parte di questo piano (rimandato)

- Tool calling vero (richiederebbe modifiche a `unified-assistant` per esporre `propose_harmonize_actions` come tool nativo del provider). Continuiamo con JSON puro + parser robusto, come concordato.
- Migrazione retroattiva dei run vecchi al nuovo schema.
- UI per gestire la coda `harmonizer_followups` (per ora solo registrazione, gestione manuale via SQL/dashboard).

## Risultato atteso

Dopo questo refactor:
- Il prompt resta a ~800 token e cambia raramente.
- Aggiungere conoscenza all'Harmonizer = aggiungere/modificare un `.md` in `public/kb-source/harmonizer/`, **senza toccare codice né prompt**.
- L'Harmonizer riceve davvero il `goal` dell'utente.
- L'Harmonizer conosce schema colonne, enum, dominio, policy attive, contratti.
- L'Harmonizer può creare e modificare agenti davvero.
- Le proposte non eseguibili lasciano traccia (`harmonizer_followups`) invece di sparire.
- Le proposte approvate generano agent_task e arricchiscono la memoria storica (`80-resolved-cases.md`).
- L'Harmonizer migliora col tempo invece di ricominciare da zero ad ogni run.
