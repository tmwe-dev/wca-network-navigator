# Audit AI Prompts — 28 Aprile 2026

Verifica file-per-file di TUTTI gli orchestratori AI per distinguere:

- 🔴 **HARDCODING NOCIVO** → da liberare (mappature statiche, schema duplicato, esempi rigidi che potrebbero/dovrebbero stare in DB/KB).
- 🟡 **POLICY LEGITTIMA** → da preservare (regole di business intenzionali, guardrail di sicurezza, contratti di output che la UI parsa).
- 🟢 **GIÀ LIBERO** → identità in KB/personas, prompt operativi caricati da DB, niente da fare.

Criterio di "nocivo": è hardcoded qualcosa che:
1. duplica lo schema DB (e si rompe quando il DB cambia, come `imported_contacts.city`),
2. impone esempi/few-shot che limitano il ragionamento,
3. enumera valori (status, categorie, paesi) che esistono già come `pg_enum` o tabella di lookup,
4. dovrebbe vivere nel Prompt Lab DB (regole modificabili senza redeploy) ma sta nel codice.

---

## Riepilogo (21 funzioni)

| Funzione | Stato | Priorità refactor |
|---|---|---|
| `ai-query-planner` | 🟢 Già liberato (28/04) | — |
| `ai-deep-search-helper` | 🟢 Solo wrapper, no prompt | — |
| `ai-arena-suggest` | 🟢 Solo wrapper helper | — |
| `agent-execute` | 🟢 Assembler+KB+personas | — |
| `ai-assistant` | 🟢 Assembler+KB+personas | — |
| `agent-loop` | 🟢 Persona DB + capabilities DB + Prompt Lab | — |
| `agent-autonomous-cycle` | 🟡 Soglie configurabili da DB, OK | — |
| `agent-autopilot-worker` | 🟢 Worker, no prompt | — |
| `improve-email` | 🟡 Categorie KB hardcoded → minore | BASSA |
| `generate-email` | 🟡 Identità "Editor WCA" hardcoded → discutibile | MEDIA |
| `generate-outreach` | 🔴 Filosofia WCA + regole anti-ripetizione + LANGUAGE RULES tutte nel codice | **ALTA** |
| `classify-email-response` | 🔴 Domain detection rules + 28 categorie hardcoded nel prompt | **ALTA** |
| `classify-inbound-message` | 🟡 Schema classificazione fisso (è il contratto JSON) | BASSA |
| `categorize-content` | 🟡 Categorie minimali, OK | — |
| `parse-business-card` | 🟡 Schema OCR fisso (giusto, è output strutturato) | — |
| `linkedin-ai-extract` | 🟡 Schema estrazione fisso (giusto) | — |
| `whatsapp-ai-extract` | 🟡 "REGOLE ASSOLUTE" su direction/spam → policy | — |
| `parse-profile-ai` | 🟡 office_type enum hardcoded → giusto, è schema output | — |
| `suggest-email-groups` | 🟡 Regole minime ("usa solo gruppi esistenti") | — |
| `generate-aliases` | 🔴 "REGOLE PER ALIAS" lunghe nel codice → spostabili in Prompt Lab | MEDIA |
| `generate-content` | 🟢 Trivial | — |
| `process-ai-import` | da verificare in fase 2 | — |

**Verdetto generale**: la maggior parte del sistema **è già libera**. I casi davvero da rifare sono **3** (`generate-outreach`, `classify-email-response`, `generate-aliases`) più la pulizia di `dbSchema.ts` (che era già stato deciso).

---

## Dettaglio per file

### 🟢 Già liberi (nessuna azione)

#### `agent-execute/systemPrompt.ts`
- L'identità arriva da `agent_personas` (DB), non dal codice.
- KB iniettata da `agent_knowledge_links` + `kb_entries`.
- Dottrina commerciale caricata da `loadCommercialDoctrine` (DB).
- L'unico testo hardcoded è la **system access note** (3 righe operative su come usare i tool) → policy legittima.

#### `ai-assistant/systemPrompt.ts`
- 66 righe totali, già "assembler-driven, KB-first".
- Identità minima ("Sei LUCA"), tutto il resto in `kb_entries` categoria `doctrine`/`procedures`.
- L'unico blocco hardcoded è il **Charter R5** (regola anti-allucinazione) → policy intenzionale e inviolabile.

#### `agent-loop/index.ts`
- Tools elencati nel codice (ok: sono il contratto OpenAI tool-calling).
- Persona caricata da `agent_personas`, capabilities da `agent_capabilities`, Prompt Lab da `operative_prompts` — **tutto DB-driven**.
- System prompt: 6 righe minime, tutto il resto iniettato.

---

### 🔴 Da liberare — **PRIORITÀ ALTA**

#### `generate-outreach/promptBuilder.ts`

**Problemi:**
1. **Filosofia WCA hardcoded** (righe 128-135) — 8 righe di filosofia commerciale inserite nel codice. Dovrebbe stare in `kb_entries` categoria `doctrine` (esiste già!).
2. **Metodo a 3 step hardcoded** (righe 137-141) — istruzioni di processo che limitano l'AI. Vanno in Prompt Lab.
3. **LANGUAGE RULES hardcoded** (righe 150-154) — "Deutsch: formal Sie form. Français: formal vous form. ..." è una mappa lingua→formalità che potrebbe stare in una tabella `language_etiquette` o in KB.
4. **GUARDRAIL hardcoded** (righe 156-162) — lunghezze preferite per canale ("80-150 parole", "≤300 caratteri") sono regole di business modificabili → Prompt Lab `scope: outreach`.
5. **REGOLA ANTI-RIPETIZIONE hardcoded** (righe 165-170) — testo prescrittivo che dovrebbe essere un prompt operativo opzionale.
6. **Vincolo WhatsApp primo contatto** (righe 173-179) — dottrina multi-canale §4 citata ma duplicata nel codice. Dovrebbe vivere nella KB ed essere caricata via Prompt Lab.

**Azione:** spostare blocchi 1-6 in `kb_entries` (doctrine/procedures) e/o `operative_prompts` (`scope: outreach`). Lasciare nel codice solo: identità minima ("Sei un editor giornalista per WCA"), formato output (Subject + body), iniezione del Prompt Lab.

#### `classify-email-response/classificationPrompts.ts`

**Problemi:**
1. **DOMAIN DETECTION RULES hardcoded** (righe 96-104) — 5 categorie operative con descrizioni complete. Devono stare in DB (`email_domain_taxonomy`?) per modifica senza redeploy.
2. **28 valori di category enumerati nel JSON di output** (righe 110-111) — è uno *schema di output* quindi il principio dice "ok, è contratto" MA: la lista è duplicata in `VALID_CATEGORIES` (riga 127-133) e dovrebbe arrivare da `pg_enum` (`email_classification_category`) — stesso pattern di `ai-query-planner`.
3. **VALID_DOMAINS / VALID_CATEGORIES / VALID_URGENCY / VALID_SENTIMENT** (righe 126-134) — quattro liste hardcoded che il `responseParser` usa per validare. Se aggiungi un dominio in DB, qui resta indietro.

**Azione:** introdurre `loadEmailTaxonomy(supabase)` che legge enum + descrizioni da DB. Domain rules → KB. La validazione downstream usa i valori live.

#### `generate-aliases/index.ts`

**Problemi:**
1. **REGOLE PER ALIAS AZIENDA + REGOLE PER ALIAS CONTATTO hardcoded** (righe 54-65 ca.) — sono regole stilistiche di business dovrebbero essere in `operative_prompts` con `scope: alias_generation`, modificabili dall'utente.

**Azione:** caricare via `loadOperativePrompts(scope: "alias_generation")`, lasciare fallback minimo nel codice.

---

### 🟡 Da liberare — **PRIORITÀ MEDIA**

#### `generate-email/promptBuilder.ts`
- Identità "Editor WCA Network" hardcoded (riga 149) → è una scelta architetturale (non un agent persona) ma il commento già dice "le regole vincolanti su stile, lunghezza, ... arrivano dal Prompt Lab". **In gran parte già liberato**.
- I `systemBlocks` (righe 165-180) sono etichette per il debug Forge: legittimi.
- Il `partnerContext` (righe 61-72) è un dossier dati strutturato → ok, è user prompt non system rule.
- **Da liberare**: l'identità "Editor giornalista WCA" potrebbe spostarsi in Prompt Lab `scope: email` come prompt universale. Beneficio limitato.

#### `improve-email/index.ts`
- `categories` array hardcoded (righe 26-29) — categorie KB preferenziali per tipo email. Tollerabile (è una preferenza, non un vincolo). Potrebbe diventare `email_type_kb_categories` per tipo email (parzialmente già fatto via `extraCategories`).

#### `classify-inbound-message/index.ts`
- System prompt minimale (5 righe), Prompt Lab già caricato. **OK.**
- Mappe `mapInboundToEmailCategory` / `mapUrgencyToNumber` (righe 25-48) sono adapter di tipo, non prompt. **Legittime.**

---

### 🟡 Schema-driven legittimi (non toccare)

- `parse-business-card/index.ts` → schema OCR business card (output structured).
- `linkedin-ai-extract/index.ts` → schema estrazione profilo.
- `whatsapp-ai-extract/index.ts` → schema estrazione messaggi.
- `parse-profile-ai/index.ts` → enum `office_type` è output strutturato.
- `categorize-content/index.ts` → 5 categorie minime per content typing, output enum.
- `suggest-email-groups/index.ts` → istruzione "usa solo gruppi esistenti" è guardrail anti-allucinazione.

Questi prompt **sono giusti così**: l'output è uno schema parsato dalla UI, le "regole" sono in realtà definizioni di formato.

---

### Pulizia trasversale

#### `src/v2/agent/kb/dbSchema.ts` (deciso: eliminare)
File TS con schema hardcoded delle tabelle. Importato da:
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts` → ora usa `liveSchemaClient`, l'import a `dbSchema` è deprecato.
- `src/v2/ui/pages/command/hooks/useCommandRealtime.ts` → da verificare.

**Azione**: sostituire ovunque con `liveSchemaClient.fetchLiveSchema()` e cancellare il file.

---

## Piano di refactor proposto (in ordine di valore)

### Fase 1 — Eliminare lo schema TS hardcoded (rischio basso)
1. Sostituire import di `dbSchema.ts` in `useCommandRealtime.ts` con `liveSchemaClient`.
2. Cancellare `src/v2/agent/kb/dbSchema.ts`.
3. Verifica: build verde, query Command e HomeAIPrompt funzionano.

### Fase 2 — Liberare `generate-outreach` (impatto alto, lo usano outreach campaigns)
1. Migrare filosofia WCA + metodo + language rules + guardrail in `kb_entries` categoria `doctrine` con tag `outreach`.
2. Migrare anti-ripetizione + WhatsApp-primo-contatto in `operative_prompts` con `scope: outreach`.
3. `promptBuilder.ts` carica via `loadOperativePrompts({ scope: "outreach", channel: ch })` e KB; nel codice resta solo identità minima + formato output + dossier partner.
4. Test su 3 outreach reali (email/whatsapp/linkedin).

### Fase 3 — Liberare `classify-email-response`
1. Caricare `VALID_DOMAINS`/`VALID_CATEGORIES`/`VALID_URGENCY`/`VALID_SENTIMENT` da `pg_enum` via nuovo `loadEmailTaxonomy()` (estensione di `liveSchemaLoader`).
2. Spostare DOMAIN DETECTION RULES in `kb_entries` categoria `doctrine` tag `email-classification`.
3. `classificationPrompts.ts` compone con valori live.

### Fase 4 — Liberare `generate-aliases`
1. Migrare REGOLE PER ALIAS in `operative_prompts` `scope: alias_generation`.
2. Fallback hardcoded a 2 righe se Prompt Lab vuoto.

### Fase 5 (opzionale) — Liberare identità "Editor WCA" di `generate-email`
- Beneficio basso (1 riga di identità). Saltabile salvo richiesta.

---

## Cosa NON faremo (e perché)

- **Tool definitions OpenAI** (es. `agent-loop` riga 20-109): NON sono prompt, sono il contratto del tool-calling API. Devono stare nel codice.
- **Schema di output JSON** (parse-business-card, classify-inbound-message, ...): contratti che la UI parsa. Devono stare nel codice.
- **Hard guards** in `_shared/policy/hardGuards.ts`: sicurezza, mai delegare al modello.
- **Anti-injection sanitizer / contentNormalizer**: layer di sicurezza, non prompt.
- **Rate limiter, cost guardrail, schema validators**: infrastruttura.

---

## Conferma richiesta

Questo audit è la **fase 1** (analisi). Le **fasi 1-4 di refactor** richiedono ~6-8 migrazioni KB, 3 edge function modificate, 1 file TS cancellato.

Confermi che procedo nell'ordine proposto (Fase 1 → 2 → 3 → 4)? Oppure vuoi cambiare priorità o saltare qualcuno?