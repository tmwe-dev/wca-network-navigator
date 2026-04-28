## Diagnosi: quanta libertà stiamo dando ad AI?

### Stato attuale (misurato)

**Prompt hardcoded "tipo programma" (over-prescrizione):**

| File | LOC system prompt | Ricette dettagliate | Problema |
|---|---|---|---|
| `generate-email/promptBuilder.ts` | ~220 LOC di system prompt | filosofia WCA, missione, regole dati, "stile editor", "ancora obbligatoria", lunghezza 80-150 parole, lista frasi vietate, ordine sezioni | AI eseguito come template engine: la creatività è azzerata |
| `improve-email/index.ts` | ~60 LOC system prompt inline (350-410) | 10 regole numerate, "REGOLE DI MIGLIORAMENTO", filosofia WCA duplicata | Duplicato di promptBuilder; non lascia interpretazione |
| `generate-outreach` | system + Decision Engine block + Readiness + Playbook + commercialBlock | 5+ blocchi prescrittivi sovrapposti | AI riceve istruzioni contraddittorie da fonti diverse |
| `agent-loop` (LUCA) | 12 righe di "Regole" hardcoded | 6 numerated rules + KEYWORDS forbidden list (`drop table`, `delete account`...) | LUCA è ridotto a parser di tool calls |
| `src/v2/agent/prompts/core/luca.ts` | "Regole tassative" + "Output Markdown ### sezioni, tabelle per 3+ elementi, max 3 azioni" | Decide per AI il formato output | Vincoli estetici al posto di obiettivi |
| `src/v2/agent/prompts/core/cockpit-assistant.ts` | "WhatsApp solo se lead_status in [...]" + JSON output rigido | Replica regola business già nel DB Prompt Lab | Doppia enforcement: AI non può ragionare |
| `src/v2/agent/prompts/core/contacts-assistant.ts` | "Restituisci comandi con delimitatore `---COMMAND---`" | Vincolo formato AI-unfriendly | |
| `query-planner.ts` | Schema JSON imposto + "MAI esegui" | OK come guardrail tecnico | Accettabile (output strutturato necessario) |

**Prompt Lab DB (7 prompt operativi attivi):**
Stessi temi (Email A→Z, WhatsApp Gate, Lead Qualification, Multi-canale, Post-Send) sono **anche** nel DB. Risultato: AI riceve la regola **due volte**, una volta hardcoded nel prompt e una volta dal Prompt Lab. Conflitti possibili e zero spazio interpretativo.

**Guardrail veri (in codice, ottimi):**
- `src/v2/agent/policy/hardGuards.ts`: `FORBIDDEN_TABLES`, `AI_WRITABLE_TABLES`, `assertNotDestructive`, `assertBulkCap`, `requiresApproval` ✅
- Trigger DB soft-delete ✅
- Approval-gate per send_* ✅
- RLS + RBAC ✅

→ **I guardrail giusti esistono già nel codice e nel DB.** Il problema è che ai prompt sopra abbiamo aggiunto **una seconda parete prescrittiva** che soffoca l'AI.

### Esempio concreto del problema

Utente: "scriviamo a Luca Arcanà gli auguri di Natale" (28 aprile).

- LUCA agente ha risposto correttamente ("è il 28 aprile, forse si spaventa") → **buon ragionamento**
- Ma poi ha fatto solo `Cerca Luca Arcanà` con filtro stretto e si è fermato a "0 risultati" → **non ha provato varianti, non ha proposto alternative, non ha chiesto chiarimenti**

Perché? Il prompt di LUCA dice "max 3 azioni suggerite", "Markdown ### sezioni", cita 11 doctrine, ma **non gli dice "se non trovi, varia la query, esplora, ragiona come farebbe un umano"**. Diamo regole formali, togliamo iniziativa.

---

## Filosofia della rifattorizzazione

> **AI è uno spazio aperto a 360°. Ogni istruzione lo restringe. Diamo guardrail, non binari.**

Tre principi:

1. **Identità + obiettivo + contesto** → cosa vogliamo
2. **Guardrail "non puoi"** → cosa è vietato (in codice, non in prompt)
3. **Capacità "puoi"** → quali strumenti ha

NIENTE ricette step-by-step, NIENTE formati output rigidi se non strettamente necessari, NIENTE liste di frasi vietate, NIENTE doctrine duplicate (vivono nel Prompt Lab DB, non nei system prompt TS).

---

## Piano operativo

### Fase 1 — Snellire i system prompt hardcoded (libertà)

**1.1 `generate-email/promptBuilder.ts`** (220 LOC → ~40 LOC)
- Mantenere: identità ("editor giornalista WCA"), obiettivo ("UN messaggio per UN destinatario"), il **dossier** completo (è contesto, non istruzione)
- Rimuovere: "REGOLE SUI DATI bilanciate" punto-per-punto, "COME SCRIVE L'EDITOR" stile obbligatorio, "ANCORA OBBLIGATORIA" con tag `[GENERIC]`, lista frasi vietate, lunghezza fissa 80-150 parole
- Rimpiazzare con: "Scrivi come ti suggerisce il dossier. Le regole inviolabili sono nei PROMPT OPERATIVI sotto."
- Le doctrine (no inventare, lunghezza, tono) restano nel Prompt Lab DB → **single source of truth**

**1.2 `improve-email/index.ts`**
- Eliminare i 60 LOC di system prompt inline, sostituire con prompt minimale (5 righe) + iniezione `loadOperativePrompts(scope: "email-quality")` che già c'è
- Le 10 regole numerate spariscono dal codice; vivono solo in `Email Improvement Techniques` (già nel DB)

**1.3 `generate-outreach`**
- Rimuovere readiness warnings prescrittivi nel prompt (restano in metadata UI)
- Decision Engine block diventa "informativo", non direttivo ("ti dico cosa il sistema osserva, decidi tu")

**1.4 `agent-loop` + `src/v2/agent/prompts/core/luca.ts`**
- Eliminare le 6 "Regole" numerate hardcoded e la `FORBIDDEN_KEYWORDS` (è teatro: il vero blocco è in `hardGuards.ts`)
- Nuovo prompt: identità + obiettivo + tools disponibili + "se non trovi qualcosa, varia approccio, prova sinonimi, accenti diversi, chiedi all'utente"
- Rimuovere "Markdown ### sezioni, tabelle per 3+ elementi, max 3 azioni" → l'AI sceglie il formato giusto

**1.5 `cockpit-assistant.ts` / `contacts-assistant.ts`**
- Rimuovere le regole business duplicate (gate WhatsApp ecc.: vivono già nel Prompt Lab + hardGuards)
- Mantenere solo il contratto JSON dove l'UI lo richiede davvero

### Fase 2 — Rendere l'AI più "intelligente nel cercare" (esempio Luca Arcanà)

Il caso d'uso ha mostrato che l'AI non esplora. Soluzione lato **prompt**, non codice:

- In `query-planner.ts`: aggiungere principio "se la prima query torna vuota, riprova con varianti (rimuovi accenti, accorcia, prova solo cognome, prova solo azienda separatamente)". **Non come step rigido, come capacità.**
- In `agent-loop`: aggiungere capacità "auto-retry semantico": se un tool torna vuoto, l'AI può rilanciare con parametri ammorbiditi senza chiedere all'utente.
- **Nessuna logica TypeScript nuova**: il lavoro accent-stripping già messo in `safeQueryExecutor.ts` resta come safety-net, ma l'AI ora *sa* di poter ritentare.

### Fase 3 — Allineamento Prompt Lab ↔ Codice

- Verificare che i 7 prompt operativi nel DB coprano TUTTE le regole tolte dal codice. Mancanze attese (da aggiungere):
  - Regola "no allucinazioni numeri" → integrare in `Email Single A→Z`
  - Stile "asciutto, professionale" → nuovo prompt `email-style` o sezione in `Email Improvement Techniques`
- Audit table: per ogni regola hardcoded che togliamo, identificare il prompt DB equivalente. Documentare in `mem://architecture/operative-prompts-unified-loader`.

### Fase 4 — Verifica empirica

Test manuali post-modifica (l'utente sceglie 3 casi):
1. "Scrivi auguri di Natale a Luca Arcanà" → l'AI deve obiettare la data E proporre alternative E provare ricerche varianti.
2. "Genera email per [partner con dati scarsi]" → l'AI deve scegliere lei lo stile, non applicare template.
3. "Manda WhatsApp a [lead nuovo]" → l'AI deve rifiutare citando il gate (regola DB), non da prompt hardcoded.

---

## Riepilogo numerico atteso

| Metrica | Prima | Dopo |
|---|---|---|
| LOC system prompt hardcoded (8 file) | ~600 | ~120 |
| Regole business duplicate (codice ↔ DB) | ~25 | 0 |
| Frasi "VIETATO/MAI/OBBLIGATORIO" nei prompt TS | ~40 | <5 (solo guardrail tecnici) |
| Source of truth regole commerciali | 2 (codice + DB) | 1 (DB Prompt Lab) |
| Guardrail tecnici hard (`hardGuards.ts`, RLS, trigger) | invariati | invariati ✅ |

## Cosa NON tocco

- `src/v2/agent/policy/hardGuards.ts` (guardrail veri, restano)
- RLS, trigger soft-delete, approval gate
- Edge functions tecniche (parser, OCR, IMAP, scraper)
- Schema DB `operative_prompts`
- Loader unificato `_shared/operativePromptsLoader.ts` (appena fatto, funziona)

## Domanda di scoping prima di procedere

Vuoi che parta con tutta la Fase 1 in un unico passaggio (8 file), oppure preferisci che la spezzi (es. prima `agent-loop` + `luca.ts` perché è il caso che hai vissuto, poi gli altri)?
