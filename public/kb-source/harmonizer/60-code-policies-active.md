---
name: Policy hard nel codice (read-only)
description: Lista delle policy hard implementate in TypeScript. Se un gap richiede una di queste, resolution_layer DEVE essere code_policy con readonly_note.
tags: [harmonizer, code-policy, hardguards, readonly]
---

# Policy hard attive nel codice

Queste policy vivono in TypeScript e bloccano l'AI a runtime. **L'Harmonizer non può "scriverle meglio in testo"** — può solo segnalarle come `readonly_note` con `resolution_layer = code_policy`.

## Policy in `src/v2/agent/policy/hardGuards.ts`

### `FORBIDDEN_TABLES`
Tabelle assolutamente vietate alle scritture AI: `auth.users`, `auth.sessions`, `user_roles`, `authorized_users`, `vault.secrets`, `supabase_functions`, `storage.objects`.

### `AI_WRITABLE_TABLES` (whitelist)
Solo queste tabelle accettano scritture AI: `activities`, `ai_conversations`, `ai_daily_plans`, `ai_memory`, `ai_pending_actions`, `ai_work_plans`, `agent_tasks`, `channel_messages`, `email_drafts`, `imported_contacts`, `kb_entries`, `mission_actions`, `outreach_queue`, `outreach_schedules`, `partners`, `partner_contacts`.

### `APPROVAL_REQUIRED_TOOLS`
Tool che richiedono approvazione esplicita prima dell'esecuzione: `send_email`, `send_whatsapp`, `send_linkedin`, `execute_bulk_outreach`, `schedule_campaign`, `update_partner_status_bulk`, `update_contact_status_bulk`.

### `assertNotDestructive()`
Blocca qualsiasi azione che inizi con `delete`, `drop`, `truncate`. Se un gap propone "elimina X" → `code_policy`.

### Bulk caps
`DEFAULT_BULK_CAP=5` (auto-approvabile fino a 5 record), `MAX_BULK_CAP_HARD=100` (mai oltre, neanche con conferma).

## Policy da `mem://constraints/`

### `no-physical-delete`
Trigger DB intercetta DELETE su tabelle business e lo trasforma in soft delete (`deleted_at = now()`). Mai bypassabile.

### `no-wca-download-ai`
Gli agenti AI non devono proporre o orchestrare download/scansioni WCA. Solo arricchimento e deep search.

### `email-download-integrity`
Codice di download/sync email è intoccabile da AI. Modifiche solo dallo sviluppatore.

## Policy in `src/v2/lib/feature-flags.ts` (selezionate)

Feature flag che gating funzionalità. L'Harmonizer non può attivarle/disattivarle, può solo segnalarle.

## Policy implicite

- **Lead lifecycle monotono**: trigger DB impedisce di tornare indietro nello stato lead (es. da `engaged` a `new`). Vedi `30-business-constraints.md`.
- **Same-Location Guard**: un lead = un agente. Hardcoded nei trigger di assignment.
- **Approval-first**: nessun invio outbound senza riga in `ai_pending_actions` con status `approved`.

## Format della `readonly_note` per code_policy

Quando l'Harmonizer rileva un gap che richiede una di queste policy:

```json
{
  "action_type": "INSERT",
  "target_type": "readonly_note",
  "block_name": "[code_policy] <descrizione corta>",
  "resolution_layer": "code_policy",
  "current_issue": "<cosa manca o cosa non va a runtime>",
  "proposed_content": "<descrizione precisa di cosa lo sviluppatore deve aggiungere/modificare in TypeScript>",
  "evidence": [...],
  "missing_contracts": [],
  "code_policy_needed": "<nome policy + file dove va aggiunta, es. 'hardGuards.ts FORBIDDEN_TABLES'>",
  "severity": "high|critical",
  "impact_score": 7,
  "test_urgency": "alta",
  "apply_recommended": false
}
```

`apply_recommended: false` perché non è eseguibile dal sistema. Va in `harmonizer_followups`.