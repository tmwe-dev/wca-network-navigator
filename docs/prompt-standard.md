# Standard "Professore" — Prompt Operativi WCA
_Versione 1.0 — 2026-05-02_

Tutti i prompt operativi (DB `operative_prompts`, file `supabase/functions/_shared/prompts/core/*.ts`, persona DB `agent_personas`) devono seguire questo template. Lo scopo è uniformare il pensiero degli agenti su un metodo investigativo: **capire il problema → consultare memoria/KB → diagnosticare → proporre azioni**, senza mai contenere logica hard-coded che dovrebbe vivere nel codice.

---

## Principio guida

L'agente è un **professionista esperto** con accesso a:
1. **Memoria** (interazioni passate, esiti, feedback) — fonte primaria di apprendimento.
2. **Knowledge Base** (`kb_entries`, `system_doctrine`, `agent_doctrine`) — regole, procedure, fatti canonici dell'azienda.
3. **Strumenti** (tool whitelist da `agent_capabilities`) — azioni disponibili sul sistema.
4. **Contesto runtime** (partner, email, BCA, holding pattern…) iniettato dall'orchestratore.

L'agente NON deve:
- Contenere SQL, JSON schema, regex, snippet di codice o nomi di tabelle/colonne.
- Duplicare regole già presenti nella KB (le richiama, non le ricopia).
- Decidere senza prima consultare memoria + KB.
- Produrre output senza un piano d'azione concreto.

---

## Template a 5 sezioni

Ogni prompt operativo deve contenere **esattamente** queste 5 sezioni nell'ordine:

### 1. IDENTITÀ
Chi è l'agente in 2-3 righe. Nome, ruolo professionale (non tecnico), tono.

> _Esempio:_ "Sei Marco, stratega commerciale del network WCA. Pensi come un consulente senior: pragmatico, sintetico, orientato al risultato."

### 2. OBIETTIVO
Lo scopo finale di questa invocazione, in 1-2 righe. Un solo verbo principale.

> _Esempio:_ "Decidere il prossimo passo commerciale per il partner indicato, scegliendo tra: contattare ora, attendere, escalation, archivio."

### 3. METODO (Analisi → Memoria → KB → Diagnosi → Azioni)
Il cuore del prompt. Sempre questi 5 passi, in quest'ordine:

1. **Analisi**: cosa sai dal contesto fornito? Quali dati mancano?
2. **Memoria**: ci sono interazioni precedenti rilevanti? Esiti? Pattern?
3. **KB**: quali regole/procedure aziendali si applicano qui? Cita la card per nome.
4. **Diagnosi**: qual è il problema reale (non il sintomo)? Una sola frase.
5. **Azioni**: piano concreto, max 3 step, ciascuno con strumento da invocare.

### 4. GUARDRAIL
Cosa l'agente NON deve mai fare. Limiti hard-coded di sicurezza/business.
Esempi tipici:
- "Mai inviare email senza review editoriale (`journalistReview`)."
- "Mai contattare partner in holding pattern ✈️ senza autorizzazione."
- "Mai proporre download massivi WCA."

### 5. OUTPUT
Formato richiesto. Quando possibile, JSON con schema esplicito a parole (no codice).

> _Esempio:_ "Restituisci un oggetto con: `decision` (stringa), `reasoning` (max 200 char), `next_actions` (array di azioni con `tool` e `args`)."

---

## Esempio completo (prompt pilota: "Marco — Strategy")

```
1. IDENTITÀ
Sei Marco, stratega commerciale del network WCA. Consulente senior, sintetico, decisionale.

2. OBIETTIVO
Decidere il prossimo passo commerciale per il partner indicato.

3. METODO
- Analisi: leggi partner, ultimo contatto, lead_status, BCA, score.
- Memoria: cerca interazioni ultimi 90 giorni, esiti email/WA/LI, feedback umano.
- KB: applica "Commercial Strategy Rules", "Holding Pattern", "Lead Status Guard".
- Diagnosi: in una frase, qual è il vero blocco o opportunità.
- Azioni: max 3 step. Ciascuno: strumento + perché + quando.

4. GUARDRAIL
- Mai bypassare holding pattern senza autorizzazione esplicita.
- Mai cambiare lead_status senza status_reason.
- Mai proporre più di 1 contatto/7gg sullo stesso partner.
- Mai inviare contenuti senza journalistReview.

5. OUTPUT
JSON: { decision, reasoning (≤200 char), next_actions: [{tool, args, why}] }
```

---

## Cosa NON è uno standard

- **Persona** (tono, lingua, stile) → vive in `agent_personas`, non nel prompt operativo.
- **Tool whitelist** → vive in `agent_capabilities`, non nel prompt.
- **Contesto runtime** (dati partner, email inbound) → iniettato dall'orchestratore via `_shared/agent-execute/contextInjection`, non hard-coded.
- **Schema dati** → vive in `system_doctrine` KB, l'agente lo richiama per nome.

Se un prompt contiene una di queste cose, è da rifattorizzare.

---

## Processo di rewriting (case-by-case)

1. Audit del prompt esistente → identifica ridondanze e logica hard-coded.
2. Riscrittura in formato 5-sezioni → salvata in `/mnt/documents/prompt-rewrite-proposals/<nome>.md`.
3. Diff vs originale incluso nel file.
4. Approvazione utente per ogni singolo prompt.
5. Update DB (`operative_prompts.body` o `agents.system_prompt`) → snapshot automatico in `prompt_versions` via trigger.
6. Test di regressione via `prompt-test-runner` con i `prompt_test_cases` esistenti.

---

## Riferimenti incrociati

- Memoria operativa: `mem://architecture/structured-operative-prompts-protocol`
- Persona DB: `mem://features/agent-personas-db-layer`
- Capabilities DB: `mem://features/agent-capabilities-db-layer`
- Versioning + test: `mem://features/prompt-versioning-and-regression-tests`
- Sanitizer/normalizer: `mem://security/prompt-sanitizer-layer` + `mem://features/content-normalization-layer`
- Editorial review: `mem://tech/editorial-review-layer-mandatory`