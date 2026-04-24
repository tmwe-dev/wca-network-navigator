---
name: Schema di output dell'Harmonizer
description: Schema JSON completo che l'Harmonizer deve emettere, con esempi pieni e anti-esempi. Letto come reference autoritativa del formato di risposta.
tags: [harmonizer, output, schema, json]
---

# Schema di output (vincolo assoluto)

L'Harmonizer risponde **SOLO** con un blocco JSON valido. Niente markdown, niente preamboli, niente conclusioni.

## Struttura top-level

```json
{
  "proposals": [ /* array di Proposta, vedi sotto */ ]
}
```

Se non hai proposte valide: `{ "proposals": [] }`.

## Schema di una Proposta

```json
{
  "action_type": "UPDATE | INSERT | MOVE | DELETE",
  "target_type": "kb_entry | agent | agent_persona | operative_prompt | email_prompt | email_address_rule | playbook | system_prompt_block | readonly_note",
  "block_name": "string (max 80 char, descrizione corta del blocco)",
  "severity": "low | medium | high | critical",
  "impact_score": 1,
  "test_urgency": "bassa | media | alta | critica",
  "test_areas": ["smoke_kb | smoke_agent_chat | smoke_composer | smoke_voice | manual_review | runtime_check"],
  "resolution_layer": "text | kb_governance | contract | code_policy",
  "current_location": "string (es. 'kb_entries/system_doctrine' o vuoto se INSERT)",
  "proposed_location": "string (es. 'kb_entries/procedures')",
  "current_issue": "string (descrizione precisa del gap)",
  "proposed_content": "string (testo nuovo o descrizione di cosa va fatto)",
  "evidence": [
    {
      "source_type": "desired_library | db_block | uploaded_doc | system_profile",
      "source_ref": "string (path file, id blocco DB, ecc.)",
      "evidence_excerpt": "string (max 280 char, citazione esatta)"
    }
  ],
  "required_variables": [
    {
      "name": "string",
      "contract_status": "existing | missing",
      "contract_name": "string (es. 'EmailBrief')"
    }
  ],
  "missing_contracts": [
    {
      "contract_name": "string",
      "field_name": "string",
      "field_type": "string"
    }
  ],
  "code_policy_needed": "string | null",
  "dependencies": ["proposal_id_1", "proposal_id_2"],
  "tests_required": ["smoke_kb", "manual_review"],
  "apply_recommended": true
}
```

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

## Mapping `target_type` → tabella DB (per executor)

| target_type | Tabella DB | Esecuzione |
|---|---|---|
| `kb_entry` | `kb_entries` | UPDATE/INSERT/MOVE/DELETE soft |
| `agent` | `agents` | UPDATE/INSERT, **mai DELETE** |
| `agent_persona` | `agent_personas` | UPDATE/INSERT, **mai DELETE** |
| `operative_prompt` | `operative_prompts` | UPDATE field-based |
| `email_prompt` | `email_prompts` | UPDATE field-based |
| `email_address_rule` | `email_address_rules` | UPDATE field-based |
| `playbook` | `commercial_playbooks` | UPDATE field-based |
| `system_prompt_block` | `app_settings` | UPDATE/INSERT key/value |
| `readonly_note` | `harmonizer_followups` | INSERT (registrazione, non esecuzione) |

## Esempio pieno 1 — UPDATE su kb_entry

```json
{
  "action_type": "UPDATE",
  "target_type": "kb_entry",
  "block_name": "Tono di voce email partner WCA First",
  "severity": "low",
  "impact_score": 3,
  "test_urgency": "bassa",
  "test_areas": ["smoke_kb", "manual_review"],
  "resolution_layer": "text",
  "current_location": "kb_entries/sales_doctrine",
  "proposed_location": "kb_entries/sales_doctrine",
  "current_issue": "Contenuto datato: parla ancora di stagione 2024 e usa esempi non più attuali.",
  "proposed_content": "Per le email a partner WCA First adottiamo un tono formale-cordiale, esordio con riferimento alla rete...",
  "evidence": [
    {
      "source_type": "desired_library",
      "source_ref": "libreria-tmwe.md#tono-email-wca-first",
      "evidence_excerpt": "Per WCA First: tono formale-cordiale, mai colloquiale, esordio sempre con riferimento alla rete."
    }
  ],
  "required_variables": [],
  "missing_contracts": [],
  "code_policy_needed": null,
  "dependencies": [],
  "tests_required": ["smoke_kb"],
  "apply_recommended": true
}
```

## Esempio pieno 2 — readonly_note per code_policy

```json
{
  "action_type": "INSERT",
  "target_type": "readonly_note",
  "block_name": "[code_policy] Auto-blacklist dopo 3 bounce email",
  "severity": "high",
  "impact_score": 8,
  "test_urgency": "alta",
  "test_areas": ["runtime_check", "smoke_composer"],
  "resolution_layer": "code_policy",
  "current_location": "",
  "proposed_location": "src/v2/services/email/bounce-handler.ts",
  "current_issue": "La libreria richiede transizione automatica a 'blacklisted' dopo 3 bounce, ma manca trigger DB / handler dedicato.",
  "proposed_content": "Aggiungere in bounce-handler un contatore bounce per contatto e una transizione automatica lead_status='blacklisted' al raggiungimento di 3.",
  "evidence": [
    {
      "source_type": "desired_library",
      "source_ref": "libreria-tmwe.md#bounce-policy",
      "evidence_excerpt": "Dopo 3 bounce consecutivi un contatto va automaticamente in blacklisted."
    }
  ],
  "required_variables": [],
  "missing_contracts": [],
  "code_policy_needed": "bounce-handler.ts: contatore bounce + transizione lead_status",
  "dependencies": [],
  "tests_required": ["runtime_check"],
  "apply_recommended": false
}
```

## Anti-esempi (JSON invalido)

❌ `action: "UPDATE"` invece di `action_type: "UPDATE"` → parser fallisce.

❌ `impact_score: "alto"` invece di numero → parser fallisce.

❌ `evidence: { source_type: "...", ... }` (oggetto) invece di array → parser fallisce. `evidence` è SEMPRE array, anche con un solo elemento.

❌ Markdown nel JSON: ```json ... ``` → vietato. Solo JSON puro.

❌ Trailing comma: `[ {...}, ]` → JSON invalido.

❌ Commenti: `// nota` → JSON non supporta commenti.

## Regole di validità finali

- JSON puro, parsabile da `JSON.parse()`.
- Tutti i campi obbligatori presenti (anche se array/null vuoti).
- `evidence` mai vuoto se `apply_recommended: true`.
- `dependencies` referenzia solo id di proposte presenti nello stesso `proposals` array.
- Se `resolution_layer ∈ {contract, code_policy}` → `apply_recommended` DEVE essere `false`.
- Se `target_type = readonly_note` → `action_type` DEVE essere `INSERT`, `apply_recommended: false`.