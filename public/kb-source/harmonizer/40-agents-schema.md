---
name: Schema completo tabella agents e agent_personas
description: Campi, tipi, default, vincoli, enum validi per agents e agent_personas. Letto quando l'Harmonizer propone INSERT o UPDATE su agenti.
tags: [harmonizer, schema, agents, db]
---

# Schema tabella `agents`

Snapshot estratto dal DB. Aggiornare se cambia lo schema.

## Campi principali

| Campo | Tipo | Nullable | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Owner dell'agente |
| `operator_id` | uuid | YES | `get_current_operator_id()` | Operatore proprietario |
| `name` | text | NO | — | Nome dell'agente (es. "Luca", "Bruce") |
| `role` | text | NO | `'outreach'` | Ruolo funzionale, vedi enum sotto |
| `avatar_emoji` | text | NO | `'🤖'` | Emoji rappresentativa |
| `system_prompt` | text | NO | `''` | Prompt fondamentale dell'agente |
| `knowledge_base` | jsonb | NO | `'[]'` | Array di id/categorie KB filtrate |
| `assigned_tools` | jsonb | NO | `'[]'` | Lista tool autorizzati |
| `territory_codes` | text[] | YES | `'{}'` | Country code ISO assegnati (es. `{IT,FR,DE}`) |
| `assigned_tutor_id` | uuid | YES | — | Agente "tutor" che guida questo |
| `can_send_email` | boolean | YES | `false` | Capability flag |
| `can_send_whatsapp` | boolean | YES | `false` | Capability flag |
| `can_access_inbox` | boolean | YES | `false` | Capability flag |
| `daily_send_limit` | integer | YES | `50` | Cap giornaliero invii |
| `elevenlabs_agent_id` | text | YES | — | Per agenti voice |
| `elevenlabs_voice_id` | text | YES | — | Per agenti voice |
| `voice_call_url` | text | YES | — | Webhook chiamate |
| `signature_html` | text | YES | — | Firma HTML email |
| `signature_image_url` | text | YES | — | URL immagine firma |
| `schedule_config` | jsonb | NO | `'{"mode":"manual"}'` | Configurazione esecuzione |
| `stats` | jsonb | NO | `'{"calls_made":0,"emails_sent":0,"tasks_completed":0}'` | Contatori |
| `is_active` | boolean | NO | `true` | Soft enable |
| `deleted_at` | timestamptz | YES | — | Soft delete |
| `deleted_by` | uuid | YES | — | Chi ha soft-deletato |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

## Enum validi per `role`

Valori canonici osservati in produzione (NON enum DB stretto, ma convenzione):
- `director` — agente strategico (es. Luca)
- `outreach` — agente commerciale standard
- `qualifier` — qualifica lead inbound
- `voice` — agente voice (chiamate)
- `assistant` — assistente operativo generico
- `analyst` — analisi dati e report

**Se proponi INSERT con role diverso** → segnala come `contract` (richiede aggiornamento enum convention) o usa uno esistente.

## Vincoli per INSERT su `agents`

Campi **obbligatori** che la proposta deve includere in `payload`:
- `name` (text, non vuoto)
- `user_id` (uuid, l'operatore corrente)
- `system_prompt` (text, può essere stringa vuota ma deve esistere)

Campi **fortemente consigliati**:
- `role` (default `outreach`)
- `territory_codes` (almeno uno se l'agente è territoriale)
- `assigned_tools` (anche `[]`)
- `knowledge_base` (almeno `[]`)
- `avatar_emoji`

Campi **proibiti** in INSERT da Harmonizer:
- `id`, `created_at`, `updated_at` (gestiti dal DB)
- `stats` (default automatico)
- `deleted_at`, `deleted_by` (soft delete è azione separata)

## Vincoli RLS

`agents` ha RLS che richiede `user_id = auth.uid()` per scrittura. L'executor passa l'`userId` dell'operatore corrente. **Non proporre INSERT con user_id di un altro operatore.**

# Schema tabella `agent_personas`

| Campo | Tipo | Nullable | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `agent_id` | uuid | NO | — | FK su `agents.id` |
| `user_id` | uuid | NO | — | Owner |
| `operator_id` | uuid | YES | `get_current_operator_id()` | Operatore |
| `tone` | text | NO | `'formale'` | Vedi enum |
| `custom_tone_prompt` | text | YES | — | Prompt tonale personalizzato |
| `language` | text | NO | `'it'` | Codice lingua ISO |
| `style_rules` | text[] | YES | `'{}'` | Regole stilistiche libere |
| `vocabulary_do` | text[] | YES | `'{}'` | Parole/frasi da usare |
| `vocabulary_dont` | text[] | YES | `'{}'` | Parole/frasi da evitare |
| `kb_filter` | jsonb | YES | `'{}'` | Filtro KB per questa persona |
| `example_messages` | jsonb | YES | `'[]'` | Esempi few-shot |
| `signature_template` | text | YES | — | Template firma |

## Enum validi per `tone`

- `formale`, `informale`, `diretto`, `amichevole`, `tecnico`, `consulenziale`, `commerciale`

## Vincoli su DELETE

**Mai DELETE su `agents` né `agent_personas`** — neanche soft. Cablato in `harmonizeExecutor.ts`. Se serve "spegnere" un agente: UPDATE con `is_active = false`.

## Relazione agents ↔ agent_personas

1 agente ha 1 persona. Quando proponi INSERT di un agente nuovo, **proponi anche INSERT della persona** in una proposta separata con `dependencies = [id_proposta_agente]`.