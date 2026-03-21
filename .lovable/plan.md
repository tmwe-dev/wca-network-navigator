

# Piano: Tutti gli Agenti con Tutti i Tool

## Problema

Oggi ogni template agente (`agentTemplates.ts`) assegna solo un sottoinsieme dei 41 tool disponibili. Quando un agente viene creato da template, riceve solo quei tool. Risultato: un agente Outreach non puo' fare Deep Search su un contatto, un agente Research non puo' inviare email, un agente Download non puo' creare attivita'.

L'utente vuole che **tutti gli agenti abbiano accesso a tutti i tool**, come un operatore umano.

## Soluzione

### 1. Template: assegnare tutti i tool

In `src/data/agentTemplates.ts`, ogni template avra' `assigned_tools` con la lista completa di tutti i tool (esclusi i Management tools che restano solo per il Director/Luca).

Tool completi per tutti (37 tool operativi):
```
search_partners, get_partner_detail, update_partner, add_partner_note,
manage_partner_contact, bulk_update_partners, get_country_overview,
get_directory_status, scan_directory, create_download_job,
download_single_partner, list_jobs, check_job_status,
get_partners_without_contacts, deep_search_partner, deep_search_contact,
enrich_partner_website, generate_aliases, search_contacts,
get_contact_detail, update_lead_status, search_prospects,
generate_outreach, send_email, create_activity, list_activities,
update_activity, create_reminder, update_reminder, list_reminders,
check_blacklist, get_global_summary, save_memory, search_memory,
delete_records, search_business_cards, execute_ui_action
```

I 5 tool Management (`create_agent_task`, `list_agent_tasks`, `get_team_status`, `update_agent_prompt`, `add_agent_kb_entry`) restano assegnati solo al template "account" (Luca, il Director).

### 2. Aggiornare gli agenti esistenti nel DB

Il frontend `AgentToolSelector` permette gia' di selezionare/deselezionare tool manualmente. Ma i 6 template pre-compilano solo un sottoinsieme. Aggiornando i template, i **nuovi** agenti avranno tutto. Per gli agenti **gia' esistenti**, aggiungeremo un'azione nella UI o un hook che sincronizza automaticamente i tool mancanti.

### 3. Implementare `execute_ui_action` nel backend

Questo tool e' definito nel frontend (`AVAILABLE_TOOLS`) ma **non ha implementazione** in `agent-execute`. Va aggiunto come tool che restituisce un'azione UI (navigazione, toast, filtri) al frontend.

## File da modificare

| File | Azione |
|------|--------|
| `src/data/agentTemplates.ts` | Tutti i template ricevono la lista completa dei tool operativi |
| `supabase/functions/agent-execute/index.ts` | Aggiungere implementazione `execute_ui_action` |

## Risultato

- Ogni agente puo' fare qualsiasi operazione: ricerca, download, deep search, email, attivita', reminder, blacklist, memoria
- Il system prompt continua a guidare il **comportamento** dell'agente (come usa i tool), ma non limita piu' le **capacita'**
- I Management tools restano esclusivi del Director per sicurezza gerarchica

