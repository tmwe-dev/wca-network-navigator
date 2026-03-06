

## Piano: Export CSV e Invio al Workspace tramite AI

### Obiettivo
Aggiungere due nuovi comandi AI: `export_csv` (esporta contatti selezionati/filtrati in CSV scaricabile) e `send_to_workspace` (crea attività email nel Workspace per i contatti selezionati). Entrambi gestiti lato frontend nel `handleAICommand`.

### Modifiche

**1. `src/components/contacts/ContactAIBar.tsx`** — Estendere il tipo AICommand

- Aggiungere `"export_csv" | "send_to_workspace"` al type union
- `export_csv`: campo `contact_ids` con gli ID da esportare
- `send_to_workspace`: campo `contact_ids` con gli ID da inviare al Workspace

**2. `supabase/functions/contacts-assistant/index.ts`** — Aggiornare system prompt e tools

- Aggiungere al SYSTEM_PROMPT i nuovi comandi:
  - `export_csv` — Esporta in CSV i contatti specificati. Usa `search_contacts` per ottenere gli ID, poi restituisci il comando.
  - `send_to_workspace` — Invia i contatti al Workspace per generare email. Usa `search_contacts` per gli ID.
- Aggiungere tool `export_contacts_for_csv`: restituisce i dati completi dei contatti (tutti i campi utili) per gli ID richiesti, fino a 500 record
- Il comando `export_csv` includerà i `contact_ids` — il frontend gestirà il download
- Il comando `send_to_workspace` includerà i `contact_ids` — il frontend creerà le attività

**3. `src/components/contacts/ContactListPanel.tsx`** — Gestire i nuovi comandi

- `export_csv`: 
  - Fetch dei contatti per gli ID ricevuti dal database
  - Generazione CSV con separatore `;`, BOM UTF-8, headers italiani
  - Download automatico del file
- `send_to_workspace`:
  - Per ogni contact_id, cercare se esiste un partner corrispondente (match per company_name/country)
  - Creare attività `send_email` nella tabella `activities`
  - Redirect a `/workspace`
  - Toast di conferma

### File da modificare

| File | Azione |
|------|--------|
| `src/components/contacts/ContactAIBar.tsx` | Estendere AICommand type |
| `supabase/functions/contacts-assistant/index.ts` | Aggiungere comandi + tool export |
| `src/components/contacts/ContactListPanel.tsx` | Gestire export_csv e send_to_workspace |

