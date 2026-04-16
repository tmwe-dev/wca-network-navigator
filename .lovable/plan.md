

# Implementazione Tool Mancanti nel Backend ai-assistant

## Situazione attuale

L'edge function `ai-assistant` ha **48+ tool** ma mancano 5 tool critici che esistono già nel modulo `agent-execute/toolHandlers.ts` ma non sono esposti nell'assistente principale:

| Tool | Esiste in agent-execute? | Esiste in ai-assistant? |
|------|--------------------------|------------------------|
| `create_contact` | ✅ (platformTools) | ❌ |
| `create_campaign` | ❌ nessuna parte | ❌ |
| `schedule_email` | Parziale (outreach_queue insert) | ❌ |
| `update_agent_prompt` | ✅ toolHandlers.ts:586 | ❌ |
| `add_agent_kb_entry` | ✅ toolHandlers.ts:598 | ❌ |

## Piano di implementazione

### 1. Aggiungere tool definitions (toolDefinitions.ts)

5 nuove definizioni nella sezione appropriata:

- **`create_contact`**: Crea un contatto in `imported_contacts`. Params: `name`, `email`, `company_name`, `phone`, `mobile`, `country`, `origin`, `lead_status`, `notes`.
- **`create_campaign`**: Crea una missione outreach in `outreach_missions`. Params: `title`, `channel` (email/whatsapp/linkedin), `target_filters` (country, lead_status, etc.), `ai_prompt`, `template_id`.
- **`schedule_email`**: Accoda un'email programmata in `outreach_queue` con `scheduled_at`. Params: `to_email`, `to_name`, `subject`, `html_body`, `partner_id`, `scheduled_at`.
- **`update_agent_prompt`**: Modifica il system_prompt di un agente. Params: `agent_name`, `replace_prompt`, `prompt_addition`.
- **`add_agent_kb_entry`**: Aggiunge una voce alla KB di un agente. Params: `agent_name`, `title`, `content`.

### 2. Aggiungere executor inline (toolExecutors.ts)

Implementazione diretta nel dispatcher `executeTool`, usando il pattern già presente nel file. La logica per `update_agent_prompt` e `add_agent_kb_entry` viene portata da `agent-execute/toolHandlers.ts` (copia adattata, ~15 righe ciascuno).

Per `create_contact`:
- Insert in `imported_contacts` con user_id
- Trigger automatico di match WCA se email/company presenti

Per `create_campaign`:
- Insert in `outreach_missions` con status `draft`
- Restituisce mission_id per successive operazioni

Per `schedule_email`:
- Insert in `outreach_queue` con status `pending` e `scheduled_at`
- Collegamento opzionale a partner_id per tracking

### 3. File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/ai-assistant/toolDefinitions.ts` | +5 tool definitions (~120 righe) |
| `supabase/functions/ai-assistant/toolExecutors.ts` | +5 case nel switch dispatcher (~80 righe) |

### Dettagli tecnici

- Tutti i 5 tool richiedono `userId` (autenticazione obbligatoria)
- `create_campaign` e `schedule_email` richiedono anche `authHeader` per eventuali sotto-invocazioni
- Nessuna migrazione DB necessaria: tutte le tabelle target (`imported_contacts`, `outreach_missions`, `outreach_queue`, `agents`) esistono già
- Deployment automatico dopo le modifiche

