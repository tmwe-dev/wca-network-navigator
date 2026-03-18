

## Aggiungere Tool di Scrittura all'Assistente AI

### Obiettivo
Permettere all'AI di **modificare dati** direttamente: aggiornare partner (rating, note, preferiti, lead status), creare reminder e aggiungere interazioni — tutto dal dialogo globale.

### Nuovi Tool (5)

**1. `update_partner`** — Aggiorna campi di un partner
- Parametri: `partner_id` (required), `is_favorite`, `lead_status`, `rating`, `company_alias`
- Cerca per ID o nome. Aggiorna solo i campi forniti.

**2. `add_partner_note`** — Crea una nota/interazione per un partner
- Parametri: `partner_id` o `company_name` (required), `subject`, `notes`, `interaction_type` (default: "note")
- Inserisce nella tabella `interactions`

**3. `create_reminder`** — Crea un reminder per un partner
- Parametri: `partner_id` o `company_name` (required), `title`, `description`, `due_date`, `priority` (low/medium/high)
- Inserisce nella tabella `reminders`

**4. `update_lead_status`** — Aggiorna lo stato lead di contatti importati
- Parametri: `contact_ids` (array) o `search_filter` (company_name/country), `status` (new/contacted/in_progress/negotiation/converted/lost)
- Opera su `imported_contacts`

**5. `bulk_update_partners`** — Aggiorna più partner insieme
- Parametri: `country_code` o `partner_ids`, `updates` (is_favorite, lead_status)
- Es: "metti tutti i partner tedeschi come preferiti"

### Modifiche al System Prompt
Aggiungere sezione che istruisce l'AI a:
- Confermare prima di eseguire modifiche bulk (>5 record)
- Salvare in memoria ogni modifica effettuata
- Descrivere cosa ha modificato nella risposta

### File da modificare
1. **`supabase/functions/ai-assistant/index.ts`** — Aggiungere 5 tool definitions + 5 funzioni di esecuzione + registrarli nel dispatcher

### Dettagli tecnici

Ogni tool di scrittura:
- Risolve `company_name` → `partner_id` automaticamente (come già fa `get_partner_detail`)
- Restituisce un riepilogo della modifica effettuata
- Registra il `partner_id` in `lastPartnerResult` per eventuale structured data

Il tool `update_partner` supporterà un subset sicuro di campi (no wca_id, no country_code, no raw_profile_html) per evitare corruzione dati.

