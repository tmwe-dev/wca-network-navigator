

L'utente vuole estendere il pattern soft-delete a TUTTE le tabelle del sistema, non solo `imported_contacts`. Devo individuare le tabelle critiche dove avviene `DELETE` fisico e applicare lo stesso pattern.

Tabelle candidate principali (dato il dominio CRM/BI):
- `partners`, `partner_contacts` (anagrafica)
- `business_cards` (BCA)
- `activities`, `reminders` (agenda)
- `import_logs`, `imported_contacts` (già fatto)
- `agents`, `outreach_missions`, `outreach_queue`, `outreach_schedules`, `mission_actions` (campagne)
- `channel_messages` (email/WA/LI)
- `kb_entries`, `ai_memory` (knowledge)
- `email_address_rules`, `directory_cache`
- `notes`, `attachments` ecc.

Tabelle dove il DELETE fisico DEVE restare (operative/audit):
- `audit_log_entries`, `supervisor_audit_log` (audit immutabile)
- `extension_dispatch_queue`, `outreach_schedules` quando `status='completed'` (ciclo di vita)
- `credit_transactions` (immutabile)
- `channel_backfill_state` (stato tecnico)
- Tabelle di cache TTL (`scrape_cache`, `directory_cache`)
- `auth.*` (gestito da Supabase)
- Tabelle di sessione/log temporanee

## Piano

### 1. Migration SQL: aggiungere `deleted_at` + `deleted_by` alle tabelle business

Tabelle da soft-deletare:
- `partners`
- `partner_contacts`
- `business_cards`
- `activities`
- `reminders`
- `agents`
- `outreach_missions`
- `outreach_queue`
- `mission_actions`
- `channel_messages` (email/WA/LI nascoste, non perse)
- `kb_entries`
- `ai_memory`
- `email_address_rules`
- `import_logs` (e cascade soft sui contatti già impostato)
- `notes` / `note_attachments` se presenti

Ogni tabella riceve:
```sql
ALTER TABLE public.<t>
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_<t>_not_deleted
  ON public.<t> (created_at DESC) WHERE deleted_at IS NULL;
```

### 2. Aggiornare RLS: nascondere automaticamente i record soft-deleted nelle SELECT

Aggiungo `AND deleted_at IS NULL` alle policy SELECT esistenti delle tabelle interessate (mantenendo policy separate per ruolo "admin recovery").

### 3. Refactor DAL (`src/data/*.ts`)

Sostituire ogni `.delete()` con `.update({ deleted_at: now(), deleted_by: uid })` nei file:
- `partners.ts`, `partnerContacts.ts`
- `businessCards.ts`
- `activities.ts`, `reminders.ts`
- `agents.ts`
- `outreach.ts` / `missions.ts`
- `channelMessages.ts`
- `kb.ts`, `memory.ts`
- `emailRules.ts`
- `importLogs.ts`
- (`contacts.ts` già fatto)

Aggiungere a ogni query SELECT principale `.is("deleted_at", null)`.

### 4. Refactor V2 IO mutations (`src/v2/io/supabase/mutations/*.ts`)

Stesso pattern per i mutator V2.

### 5. Edge Functions

Rivedere e convertire DELETE in UPDATE soft-delete in:
- `supabase/functions/agent-execute/toolHandlers.ts`
- `supabase/functions/_shared/toolHandlersWrite.ts`
- Altre edge function con `.delete()` su tabelle business (audit con grep)

Non toccare: `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memory).

### 6. Helper centralizzato

Creare `src/data/_softDelete.ts`:
```ts
export async function softDelete(table, ids) {
  return supabase.from(table)
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
}
export async function restore(table, ids) { ... }
```

E in edge functions `supabase/functions/_shared/softDelete.ts` equivalente.

### 7. Schema Zod V2

Aggiungere `deleted_at: z.string().nullable().optional()` agli schema esistenti.

### 8. Cosa NON viene toccato

- Tabelle audit/log/cache/queue tecniche (lista sopra)
- Trigger DB e cascade FK esistenti restano funzionanti (colonne nullable)
- Nessuna UI nuova "cestino" in questa fase (la creiamo dopo)
- Funzioni RPC (`get_country_stats`, `get_contact_group_counts`, ecc.) → aggiungo filtro `deleted_at IS NULL` solo dove rilevante

### 9. Verifica post-deploy

- Test: cancellare un partner / un'attività / un BCA / un messaggio → spariscono dall'UI ma restano in DB con `deleted_at IS NOT NULL`
- Query di controllo: `SELECT count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM <ogni tabella>`
- RLS: utente non-admin non vede record soft-deleted

## Risultato

Da ora in poi nessun record business viene mai eliminato fisicamente. Qualsiasi "elimina" nell'app diventa un soft-delete completamente recuperabile dal DB. I dati persi prima di questa modifica non sono recuperabili.

