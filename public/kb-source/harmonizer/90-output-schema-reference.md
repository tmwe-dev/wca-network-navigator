---
name: Schema di output dell'Harmonizer (allineato al parser Zod)
description: Schema JSON che l'Harmonizer DEVE emettere. Riflette i campi accettati dallo Zod parser in src/v2/ui/pages/prompt-lab/hooks/harmonizeAnalyzer.ts. Aggiornare entrambi insieme.
tags: [harmonizer, output, schema, json, zod]
---

# Schema di output (vincolo assoluto)

L'Harmonizer risponde **SOLO** con un blocco JSON valido. Niente markdown,
niente preamboli, niente conclusioni. In modalità ingestion (TMWE) il top-level
include anche `extracted_facts`, `new_conflicts`, `new_cross_refs` (vedi
sezione Z del briefing). Qui descriviamo SOLO il campo `proposals[]`.

## Struttura top-level

```json
{ "proposals": [ /* array di Proposta, vedi sotto */ ] }
```

Se non hai proposte valide: `{ "proposals": [] }` (poi facts/conflicts/cross-refs separati).

## Schema di una Proposta (allineato Zod)

I nomi dei campi sotto sono **autoritativi** e devono essere usati letteralmente.

```json
{
  "action_type": "UPDATE | INSERT | MOVE | DELETE",
  "target_table": "kb_entries | agents | agent_personas | operative_prompts | email_prompts | email_address_rules | commercial_playbooks | app_settings",
  "target_id":   "string | null  (id esistente per UPDATE/DELETE/MOVE; null o omesso per INSERT)",
  "target_field":"string | null  (campo specifico se UPDATE granulare)",
  "block_name":  "string  (max 80 char, descrizione corta del blocco)",
  "current_location":  "string (es. 'kb_entries/system_doctrine' o vuoto se INSERT)",
  "proposed_location": "string (es. 'kb_entries/procedures')",
  "current_issue":     "string (descrizione precisa del gap)",
  "proposed_content":  "string (testo nuovo / contenuto desiderato)",
  "before": "string | null  (snapshot pre-modifica)",
  "after":  "string | null  (snapshot post-modifica)",
  "payload": { /* oggetto opzionale con i campi DB veri (es. role, system_prompt, ecc.) */ },
  "evidence_source":   "library | real_db | uploaded_doc",
  "evidence_excerpt":  "string (citazione esatta, max ~280 char)",
  "evidence_location": "string | null  (file/path/id sorgente)",
  "dependencies": ["proposal_id_1", "..."],
  "impact_score": 1,
  "severity":     "low | medium | high | critical",
  "test_urgency": "none | manual_smoke | regression_full",
  "tests_required": ["smoke_kb", "manual_review", "..."],
  "resolution_layer": "text | kb_governance | contract | code_policy",
  "missing_contracts": [
    { "contract_name": "string", "field": "string", "why_needed": "string" }
  ],
  "apply_recommended": true,
  "reasoning": "string (motivazione concisa)"
}
```

### Campi obbligatori

- `action_type`
- `target_table` (NOMI PLURALI delle tabelle DB: `kb_entries`, `agents`, …)
- `evidence_source` + `evidence_excerpt`
- `resolution_layer`

### Errori comuni che il parser Zod RIFIUTA silenziosamente

1. **`target_type` invece di `target_table`** → la proposta viene scartata.
2. **`target_table: "kb_entry"` (singolare)** → enum non valido, scartata.
3. **`evidence` come oggetto/array invece dei campi piatti
   `evidence_source` + `evidence_excerpt` + `evidence_location`** → scartata.
4. **`impact_score` come stringa** → scartata.
5. **Markdown fence dentro un campo string** → spesso passa, ma rovina il
   contenuto in DB. Usare solo testo puro.

## Mapping `target_table` → cosa rappresenta

| target_table | Cosa rappresenta | DELETE consentito? |
|---|---|---|
| `kb_entries` | Voce KB (doctrine, procedure, marketing, system_doctrine, governance, email_strategy) | Soft delete |
| `agents` | Agente Doer | **NO** — usa `is_active=false` |
| `agent_personas` | Persona di un agente | **NO** |
| `operative_prompts` | Procedura/prompt operativo per scope | UPDATE field-based |
| `email_prompts` | Template email per scope+stage | UPDATE field-based |
| `email_address_rules` | Whitelist/regole indirizzo email | UPDATE field-based |
| `commercial_playbooks` | Sequenza commerciale multi-step | UPDATE field-based |
| `app_settings` | Setting globale key/value (es. mission, alias) | UPDATE/INSERT |

Se la tua proposta riguarda una **tabella NON elencata sopra** (es.
`harmonizer_followups`, `system_prompts`, ecc.) → **NON inventare un nuovo
target_table**: usa `app_settings` o registra come `readonly` con
`resolution_layer = code_policy` e `apply_recommended: false`.

## Calcolo `impact_score` (1–10)

| Range | Significato |
|---|---|
| 1–3 | Cosmetico / locale (refuso, riformulazione, voce KB nuova isolata) |
| 4–6 | Funzionale (modifica persona agente, nuovo playbook, MOVE intra-categoria) |
| 7–8 | Architetturale (nuovo agente, modifica system_prompt agente attivo, nuova categoria KB) |
| 9–10 | Sistemico (tocca contratti runtime, lifecycle, policy hard, voice/email shared logic) |

Fattori che alzano:
- Tocca runtime (+2)
- Tocca contratti (+3, e quasi sempre `resolution_layer=contract`)
- Tocca più blocchi (+1)
- Tocca KB doctrine `system_doctrine` (+2)
- Tocca lifecycle/routing/policy/voice (+3, e quasi sempre `resolution_layer=code_policy`)

## Esempio pieno 1 — UPDATE su kb_entries

```json
{
  "action_type": "UPDATE",
  "target_table": "kb_entries",
  "target_id": "uuid-del-blocco-esistente",
  "block_name": "Tono di voce email partner WCA First",
  "current_location": "kb_entries/sales_doctrine",
  "proposed_location": "kb_entries/sales_doctrine",
  "current_issue": "Contenuto datato: parla ancora di stagione 2024.",
  "proposed_content": "Per le email a partner WCA First adottiamo un tono formale-cordiale...",
  "before": "(testo attuale del blocco)",
  "after":  "(testo proposto)",
  "evidence_source": "library",
  "evidence_excerpt": "Per WCA First: tono formale-cordiale, mai colloquiale.",
  "evidence_location": "libreria-tmwe.md#tono-email-wca-first",
  "dependencies": [],
  "impact_score": 3,
  "severity": "low",
  "test_urgency": "manual_smoke",
  "tests_required": ["smoke_kb"],
  "resolution_layer": "text",
  "apply_recommended": true,
  "reasoning": "Allineamento tono libreria 2026."
}
```

## Esempio pieno 2 — INSERT su agents (con persona dipendente)

```json
{
  "action_type": "INSERT",
  "target_table": "agents",
  "block_name": "Nuovo agente Inbound Triage",
  "proposed_location": "agents/inbound-triage",
  "current_issue": "Manca un agente dedicato al triage delle email inbound generiche.",
  "proposed_content": "Agente che riceve inbound da info@, classifica e instrada.",
  "payload": {
    "name": "Inbox",
    "role": "qualifier",
    "system_prompt": "Sei Inbox, agente di triage...",
    "avatar_emoji": "📨",
    "knowledge_base": [],
    "assigned_tools": []
  },
  "evidence_source": "library",
  "evidence_excerpt": "Serve un agente dedicato al triage inbound.",
  "evidence_location": "libreria-tmwe.md#agenti-inbound",
  "dependencies": [],
  "impact_score": 7,
  "severity": "high",
  "test_urgency": "manual_smoke",
  "tests_required": ["smoke_agent_chat"],
  "resolution_layer": "text",
  "apply_recommended": true,
  "reasoning": "Nuovo scope coperto da nessun agente esistente."
}
```

## Esempio pieno 3 — readonly per code_policy

```json
{
  "action_type": "INSERT",
  "target_table": "app_settings",
  "block_name": "[code_policy] Auto-blacklist dopo 3 bounce email",
  "current_issue": "La libreria richiede auto-blacklist a 3 bounce, ma manca l'handler.",
  "proposed_content": "Aggiungere in bounce-handler un contatore + transizione lead_status='blacklisted'.",
  "evidence_source": "library",
  "evidence_excerpt": "Dopo 3 bounce consecutivi un contatto va automaticamente in blacklisted.",
  "evidence_location": "libreria-tmwe.md#bounce-policy",
  "dependencies": [],
  "impact_score": 8,
  "severity": "high",
  "test_urgency": "regression_full",
  "tests_required": ["runtime_check"],
  "resolution_layer": "code_policy",
  "missing_contracts": [],
  "apply_recommended": false,
  "reasoning": "Richiede implementazione developer, non eseguibile dall'Harmonizer."
}
```

## Anti-esempi (JSON che il parser rifiuta)

- ❌ `target_type: "kb_entry"` → campo sbagliato + valore singolare. Usare `target_table: "kb_entries"`.
- ❌ `evidence: [ {...} ]` → no, sono campi piatti `evidence_source` / `evidence_excerpt` / `evidence_location`.
- ❌ `impact_score: "alto"` → deve essere numero 1–10.
- ❌ Markdown fence ```json ... ``` attorno alla risposta → vietato.
- ❌ Trailing comma o commenti `// nota` → JSON invalido.
- ❌ `target_table` non in enum (es. `harmonizer_followups`) → la proposta verrà scartata.

## Regole di validità finali

- JSON puro, parsabile da `JSON.parse()`.
- `target_table` ∈ enum elencato sopra (plurale).
- Se `resolution_layer ∈ {contract, code_policy}` → `apply_recommended` DEVE essere `false`.
- `dependencies` referenzia solo id di proposte presenti nello stesso `proposals` array.