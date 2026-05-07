# Audit Sistema Funnemail — Piano Operativo

Applico il protocollo **Codex Cobra** (`codex_quick_access.md`) come guida operativa e le **istruzioni Funnemail** (docx caricato) come spec funzionale di riferimento. L'audit è **read-only**: nessuna modifica al codice, solo report finali.

**Classe intervento:** `STANDARD/READ-ONLY` — è un audit, non una modifica. Output = report con findings classificati per severità + raccomandazioni.

---

## §1 — Perimetro

**Edge functions Funnemail (9):**
`check-inbox`, `classify-email-response`, `classify-emails-batch`, `classify-inbound-content`, `classify-inbound-message`, `funnemail-auto-route`, `funnemail-classify`, `funnemail-reminders-tick`, `funnemail-scout-sender` + helper `_shared/funnemailDispatcher.ts`, `_shared/operativePromptsLoader.ts`, `_shared/edgeFnPromptRegistry.ts`.

**UI / hooks:** `src/v2/ui/pages/funnemail-inbox/*`, `FunnemailInboxPage`, `EmailIntelligencePage`, `DepartmentKanbanView`, `useFunnemailStatuses`, `useFunnemailInboxSidebarData`, `MessageClaimBanner`.

**DB:** tabelle `funnemail_*` (statuses, message_claims, reminders), `operative_prompts`, `prompt_versions`, `agent_capabilities`, `agent_personas`, `ai_interaction_log`.

**Spec funzionale:** docx 26 pagine (next-step obbligatorio, lampadina su risposta, classificazione 11 categorie risposta, 5 reparti agenda, alert WhatsApp, "Lo prendo io", deep search iniziale, presa in carico, escalation).

---

## §2 — Fasi dell'audit

### Fase A — Mappa strutturale (SC:CLASSIFY + PILLAR.I.3)
1. Catalogare ogni edge function: input, output, prompt usato, modello AI, scope `invokeAi`, dove viene chiamata.
2. Catalogare ogni pagina/hook UI: cosa legge, cosa scrive, quale edge function chiama (via DAL).
3. Verificare assenza chiamate dirette `supabase.functions.invoke` su edge AI (Charter).
4. Verificare RLS + soft-delete su tabelle `funnemail_*`.
5. **Output:** `audit/funnemail/01-structure-map.md` con grafo `Email arriva → check-inbox → classify-* → auto-route → reparto → reminders → UI`.

### Fase B — Audit prompt (PILLAR.I.4 + standard accademici)
6. Estrarre da DB (`operative_prompts`) ogni prompt usato dalle 9 edge function Funnemail (scope `classification`, `routing`, `reminder`, `inbound`).
7. **Deep search online** (websearch) su standard accademici prompt engineering 2025: OpenAI Prompt Engineering Guide, Anthropic prompt patterns, Google Prompt Eng. whitepaper, paper "The Prompt Report" (Schulhoff et al.), framework CRISPE/RACE/CARE.
8. Verificare per ciascun prompt:
   - **Posizionamento istruzioni:** ruolo/identità in cima, vincoli prima degli esempi, formato output in fondo (regola "primacy + recency");
   - **Struttura sezioni:** Identità, Obiettivo, Metodo, Guardrail, Output (memoria `professor-prompt-template`);
   - **Wrapping untrusted:** contenuto email passato via `wrapUntrusted` con fence;
   - **JSON schema:** richiesta strutturata + validazione `safeParseAiJson`;
   - **Few-shot:** presenti dove la classificazione è multi-categoria (11 tipi);
   - **Negative constraints:** "non rispondere mai a", "non inventare";
   - **Persona consistency:** persona caricata da `agent_personas`.
9. **Output:** `audit/funnemail/02-prompt-audit.md` — matrice prompt × criterio con score 0-3 e fix consigliati.

### Fase C — Audit logica & matching (PILLAR.II.1 + tracciamento flusso)
10. Tracciare per ogni categoria di risposta del docx (11 tipi: interesse reale → escalation commerciale, partner che offre lavoro, fattura, ritardo, ecc.) come viene **realmente** classificata e routata oggi.
11. Confrontare la mappa categorie-spec con l'enum reale in `classify-inbound-message` / `funnemail-auto-route`.
12. Verificare regole-chiave del docx:
    - **next-step automatico** dopo invio (esiste? dove?);
    - **lampadina su risposta** a campagna (UI evidence);
    - **anticipo job** se cliente risponde prima della data;
    - **assegnazione 5 agende** (commerciale, operativa, amministrativa, legale-fiscale, servizi generali);
    - **"Lo prendo io"** (claim system — già in memoria);
    - **alert WhatsApp** su urgenza (dispatcher);
    - **risposta automatica di presa in carico** sulle email operative.
13. Identificare **gap** tra spec docx e implementazione.
14. **Output:** `audit/funnemail/03-logic-matching.md` — tabella `Spec → Implementazione → Stato (OK / Parziale / Mancante / Divergente)` con esempi codice.

### Fase D — Test E2E e funzionali (SC:TEST)
15. Eseguire i test Deno esistenti: `funnemail-classify/index.integration.test.ts`, `funnemail-auto-route/index.integration.test.ts`.
16. Lanciare smoke test edge function reali (curl) con email sintetiche per ognuna delle 11 categorie del docx → verificare classificazione + routing + reparto assegnato.
17. Verificare idempotenza `check-inbox` (memoria: NON modificare il codice, solo testare).
18. Verificare deduplica messaggi e ordering.
19. Smoke UI sulla rotta `/v2/agenda/reparti` e `/v2/funnemail`: render, filtri, claim, reminder.
20. **Output:** `audit/funnemail/04-e2e-functional.md` — pass/fail per scenario + log.

### Fase E — Test logica end-to-end di un ciclo completo
21. Simulare workflow completo: invio campagna → risposta cliente "interesse reale" → classify → auto-route → reparto commerciale → next-step creato → claim operatore → reminder.
22. Ripetere con altri 3 scenari: rifiuto gentile, partner che offre servizi, urgenza operativa con alert WhatsApp.
23. **Output:** `audit/funnemail/05-cycle-tests.md`.

### Fase F — Confronto accademico (deep search)
24. Web search dedicate su:
    - "Email intent classification taxonomy 2024-2025" (per validare le 11 categorie);
    - "LLM prompt structure best practice 2025";
    - "AI agent routing reliability patterns";
    - Anthropic agent skills, OpenAI Cookbook email triage, paper IEEE/ACL su email intent.
25. Confronto: cosa lo stato dell'arte raccomanda vs cosa abbiamo.
26. **Output:** `audit/funnemail/06-academic-benchmark.md` con citazioni.

### Fase G — Report finale (SC:CHANGELOG style)
27. **Output:** `audit/funnemail/00-EXECUTIVE-SUMMARY.md`:
    - Score globale (0-100) per dimensione: Struttura, Prompt, Logica, Matching, E2E, Conformità accademica.
    - Top 5 finding **CRITICAL** (con riferimento Codex Cobra: PILLAR/ANTI/COMM).
    - Top 10 **STANDARD**.
    - Roadmap fix prioritizzata (Trim/Standard/Critical) — solo proposta, nessuna esecuzione.
    - Sezione `[VERIFICATO] / [ATTESO] / [ASSUNTO]` per ogni claim.

---

## §3 — Vincoli operativi

- **Read-only assoluto:** nessuna modifica a codice, prompt DB, edge function, schema. Se trovo bug critico → finding nel report, non fix.
- **Nodi intoccabili rispettati:** `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria) — solo lettura/test funzionale via curl, nessuna modifica.
- **Editorial review** rispettato: l'audit non bypassa journalistReview.
- **AI Invocation Charter** verificato come criterio, non violato dall'audit stesso.
- **Output `/mnt/documents/audit/funnemail/`** con 7 file markdown.

## §4 — Cosa NON faccio

- Non scrivo codice né migrazioni.
- Non modifico prompt in DB.
- Non eseguo invii email reali (solo classify/route in dry-run).
- Non tocco produzione: tutti i test su edge function già deployate, lette in sola lettura.

## §5 — Tempo stimato

5–7 step lunghi (deep search + analisi prompt richiede letture estese). Ti aggiorno alla fine di ogni Fase.

## §6 — Conferma richiesta

Confermi questo perimetro e l'output a 7 file in `/mnt/documents/audit/funnemail/`? Vuoi che includa anche un **diff visivo prompt vs template-professore** (memoria `professor-prompt-template`) come allegato extra?
