---
name: Contratti runtime esistenti e mancanti
description: Schema dei brief runtime (EmailBrief, VoiceBrief, ContactLifecycleBrief, OutreachBrief) e contratti mancanti noti. Letto quando un gap richiede dati strutturati non presenti.
tags: [harmonizer, contracts, runtime, brief]
---

# Contratti runtime

I "contratti" sono **schemi tipizzati** che il backend si aspetta dall'AI o passa all'AI. Vivono in TypeScript, validati con Zod. Se un gap richiede un campo non presente in nessun contratto → `resolution_layer = contract` con `missing_contracts: [...]`.

## EmailBrief

**Dove vive**: `src/v2/core/domain/EmailBrief.ts` (o equivalente).

**Cosa contiene**:
- `recipient_email: string`
- `recipient_name: string | null`
- `recipient_company: string | null`
- `subject: string`
- `body_html: string`
- `body_text: string`
- `signature_id: string | null`
- `attachments: Array<{ name, url, mime }>`
- `mission_id: string | null`
- `outreach_schedule_id: string | null`
- `agent_id: string`
- `language: 'it' | 'en' | 'es' | 'fr' | 'de'`

**Cosa manca noto**:
- `recipient_country` (richiesto per personalizzazione locale ma assente)
- `prior_thread_id` (per conversazioni multi-turn)
- `compliance_basis` (opt-in implicito vs esplicito)

## VoiceBrief

**Dove vive**: `src/v2/core/domain/VoiceBrief.ts`.

**Cosa contiene**:
- `recipient_phone: string` (E.164)
- `recipient_name: string | null`
- `script_objective: string`
- `script_opening: string`
- `agent_voice_id: string` (ElevenLabs)
- `max_duration_seconds: number`
- `recording_consent: boolean`

**Cosa manca noto**:
- `timezone_window` (per non chiamare fuori orario locale)
- `prior_call_attempts` (per gestione no-answer)

## ContactLifecycleBrief

**Dove vive**: `src/v2/core/domain/ContactLifecycleBrief.ts`.

**Cosa contiene**:
- `contact_id: string`
- `current_status: LeadStatus` (uno dei 9)
- `proposed_status: LeadStatus`
- `transition_reason: string`
- `last_interaction_at: timestamp`
- `interaction_count: number`
- `evidence: { activity_id?: string; message_id?: string; manual?: boolean }`

**Cosa manca noto**:
- `auto_blacklist_reason` (per transizioni a blacklisted automatiche)
- `revival_attempt_count` (per holding pattern)

## OutreachBrief

**Dove vive**: `src/v2/core/domain/OutreachBrief.ts`.

**Cosa contiene**:
- `mission_id: string`
- `contact_id: string`
- `channel: 'email' | 'whatsapp' | 'linkedin'`
- `scheduled_at: timestamp`
- `template_id: string | null`
- `agent_id: string`
- `priority: 'low' | 'normal' | 'high'`

**Cosa manca noto**:
- `fallback_channel` (se canale primario fallisce)
- `quiet_hours_window` (per rispetto orari)

## Format della `readonly_note` per contract

```json
{
  "action_type": "INSERT",
  "target_type": "readonly_note",
  "block_name": "[contract] <descrizione corta>",
  "resolution_layer": "contract",
  "current_issue": "Il blocco desiderato richiede campo X, non presente in nessun contratto",
  "proposed_content": "<schema esatto del campo o sub-contratto da aggiungere>",
  "evidence": [...],
  "missing_contracts": [
    { "contract_name": "EmailBrief", "field_name": "recipient_country", "field_type": "string (ISO 3166)" }
  ],
  "code_policy_needed": null,
  "severity": "medium|high",
  "impact_score": 6,
  "test_urgency": "media",
  "apply_recommended": false
}
```

`apply_recommended: false`. Va in `harmonizer_followups` per refactor backend.

## required_variables (per proposte testuali)

Quando una proposta `text` o `kb_governance` usa variabili runtime (es. `{{recipient_name}}`), elencale in `required_variables` con `contract_status`:

```json
"required_variables": [
  { "name": "recipient_name", "contract_status": "existing", "contract_name": "EmailBrief" },
  { "name": "recipient_country", "contract_status": "missing", "contract_name": "EmailBrief" }
]
```

Se anche una sola variabile è `missing`, **la proposta non è completamente eseguibile** anche se è `text`. L'executor la marca come `executed_partial` e crea automaticamente un follow-up `contract`.