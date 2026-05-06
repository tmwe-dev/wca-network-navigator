## Feature 2/4 — Stati job estesi (sul singolo messaggio Funnemail)

Obiettivo: assegnare a ogni messaggio uno **stato di lavorazione** visibile nella card e filtrabile, indipendente dal claim e dalle label IMAP. Set minimo proposto (6 stati):

| Stato | Quando si usa | Colore |
|---|---|---|
| `nuovo` | default appena arrivato | `muted` |
| `in_lavorazione` | qualcuno l'ha preso in mano | `primary` |
| `in_attesa` | aspettiamo info dal partner | `warning` |
| `da_smistare` | va spostato in altra area (vedi Sorting) | `accent` |
| `risolto` | chiuso ok | `success` |
| `archiviato` | non rilevante / spam confermato | `muted` |

Default = `nuovo`. La transizione è libera (nessun grafo rigido in V1) — la guardrail viene da audit, non da blocchi.

### Dati
Nuova tabella **`funnemail_message_status`** (separata da claims, scope per message_id):

```text
funnemail_message_status
  message_id   text PK
  group_id     uuid null
  status       text not null check (status in (...6 valori))
  status_reason text null      -- testo libero (es. "aspetto rate update")
  changed_by   uuid not null
  changed_at   timestamptz default now()
  user_id      uuid not null   -- owner mailbox
```

Tabella audit append-only **`funnemail_message_status_history`** (id, message_id, from_status, to_status, reason, changed_by, changed_at) — popolata da trigger `BEFORE UPDATE`.

RLS: SELECT auth (visibilità globale, allineata a doctrine), INSERT/UPDATE auth (qualunque operatore può cambiare stato — è collaborativo). Soft-delete trigger globale già attivo.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE funnemail_message_status`.

### DAL `src/data/funnemailStatuses.ts`
- `listStatusesForGroup(groupId)` → mappa messageId → row.
- `setMessageStatus({ messageId, groupId, status, reason? })` → upsert.
- `listStatusHistory(messageId)` per drawer dettagli.
- Hook `useFunnemailStatuses(groupId)` con realtime + React Query.

### UI
- **`FunnemailMailCard`**: pill colorato dello stato in alto, accanto al claim badge. Click → menu rapido (DropdownMenu) per cambio stato.
- **`MessageClaimBanner` / nuova `MessageStatusBanner`** in `MailReader`: mostra stato corrente + textarea "motivo" (facoltativa) + history collassabile.
- **`FunnemailListToolbar`**: filtro multi-select per stato, persistito in `GlobalFiltersContext` (chiave `funnemailInboxStatuses`).

### Non faccio
- Niente automazioni AI di transizione (lo decideremo dopo, eventuale piano separato).
- Niente collegamento a `lead_status` o pipeline commerciale (sono dimensioni diverse).
- Niente modifiche a `check-inbox` / IMAP / `funnemail_actions_log`.

---

## Feature 3/4 — Area "Sorting" separata

Obiettivo: dare alla inbox una **coda dedicata** per i messaggi che richiedono smistamento manuale (status `da_smistare` o gruppo nullo), con UX da "centro di triage". Non duplichiamo il dato: è una vista filtrata + workflow specifico.

### Dati
**Nessuna nuova tabella**. La definizione di "in sorting" è derivata:
```
sorting = funnemail_message_status.status = 'da_smistare'
        OR (no group_id assegnato AND no status registrato)
```

Aggiungiamo solo una **view DB** `funnemail_sorting_queue` (security invoker) per query efficienti + ordinamento per età. View applica già la regola sopra.

### Routing
- Nuova rotta V2: `/v2/funnemail-inbox/sorting` (sub-route della pagina esistente, non nuova page top-level).
- Sidebar: voce "Sorting" sotto "Funnemail Inbox" con badge contatore (count della view).

### UI
- Nuova page `src/v2/ui/pages/funnemail-inbox/SortingQueuePage.tsx` (logic-less, atomic).
- Hook `useFunnemailSortingQueue()` → query view + realtime su `funnemail_message_status`.
- Componente `SortingCard` riusa `FunnemailMailCard` ma con CTA principali:
  - "Sposta in gruppo…" (DropdownMenu sui gruppi attivi → chiama DAL esistente che già muove via IMAP label / aggiorna `funnemail_actions_log` — uso il flusso che c'è, non lo duplico).
  - "Marca risolto" (status = `risolto`).
  - "Archivia" (status = `archiviato`).
  - "Lo prendo io" (riusa hook claim Feature 1).

### Non faccio
- Nessuna nuova logica IMAP — uso le funzioni di "move to group" già presenti in `FunnemailMailList` / DAL esistente.
- Nessun nuovo edge function.

---

## Feature 4/4 — Reminder timer-based

Obiettivo: ogni messaggio può avere uno **snooze** ("ricordamelo tra 2h / domani / lunedì 9:00"). Allo scadere ricompare in cima alla inbox + notifica toast + (opzionale) badge persistente in `MessageClaimBanner`.

### Dati
Nuova tabella **`funnemail_message_reminders`**:

```text
funnemail_message_reminders
  id           uuid PK default gen_random_uuid()
  message_id   text not null
  group_id     uuid null
  remind_at    timestamptz not null
  note         text null
  created_by   uuid not null
  user_id      uuid not null      -- owner mailbox
  triggered_at timestamptz null   -- valorizzato dal cron quando scatta
  dismissed_at timestamptz null
```

Index: `(remind_at) WHERE triggered_at IS NULL AND dismissed_at IS NULL`.

RLS: SELECT auth (visibilità globale), INSERT/UPDATE auth.

### Edge function nuova: `funnemail-reminders-tick`
- Trigger via **pg_cron ogni 1 min** (registriamo via tool `insert` come da regola, non migration).
- Carica reminders con `remind_at <= now() AND triggered_at IS NULL`.
- Per ognuno: setta `triggered_at = now()` + insert in `funnemail_actions_log` (azione `reminder_due`) → la UI vede il nuovo log via realtime e mostra toast.
- Idempotente: ON CONFLICT DO NOTHING su action log per `(message_id, action='reminder_due', date(now()))`.

### DAL `src/data/funnemailReminders.ts`
- `createReminder({ messageId, groupId, remindAt, note? })`.
- `dismissReminder(id)`.
- `listActiveReminders(groupId?)`.
- Hook `useFunnemailReminders(groupId)` con realtime.

### UI
- **`FunnemailMailCard`**: icona ⏰ se reminder attivo, badge "tra 2h" / "domani 09:00".
- **`MailReader`**: bottone "Ricordamelo…" → popover con preset (1h, 4h, domani 9, lun 9, custom datetime) + textarea note.
- **`SortingQueuePage`**: stessa CTA disponibile.
- Toast globale quando arriva log `reminder_due` per il proprio user (listener montato in `FunnemailInboxPage` per ora — non singleton globale, niente over-engineering V1).

### Non faccio
- Nessuna integrazione push/email esterna (solo toast + badge in-app).
- Nessun edit a `check-inbox` / IMAP.
- Nessuna modifica al cron generale del sistema (creo solo lo schedule dedicato).

---

## Ordine di esecuzione tecnico
1. **Migration unica** — `funnemail_message_status` + `funnemail_message_status_history` + trigger audit + view `funnemail_sorting_queue` + `funnemail_message_reminders` + RLS + realtime publication. (1 sola call al tool migration.)
2. **DAL + hooks**: `funnemailStatuses.ts`, `funnemailSorting.ts` (lista dalla view), `funnemailReminders.ts`, hook V2 corrispondenti, query keys atomiche in `src/lib/queryKeysParts/comms.ts`.
3. **Edge function** `funnemail-reminders-tick` (logger strutturato, securityHeaders, no AI).
4. **Cron job** registrato via tool `insert` (separato dalla migration).
5. **UI**:
   - `FunnemailMailCard` → status pill + reminder icon + reminder popover.
   - `MailReader` → status banner + history + reminder popover.
   - `FunnemailListToolbar` → filtro stati.
   - `SortingQueuePage` + rotta + voce sidebar + badge contatore.
6. **Memoria**: aggiorno index con 3 nuove voci (`mem://features/funnemail-job-status`, `funnemail-sorting-queue`, `funnemail-reminders`).

## Check finali
- Batch/dedup/ordine inbox invariati (nuove tabelle sono layer paralleli, niente FK su email).
- Realtime: status/reminder propagano entro 1-2s su 2 operatori.
- Cron reminder è idempotente (no toast doppi).
- Sorting view rispetta soft-delete e RLS dei status sottostanti.
- Nessun touch a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `funnemail_actions_log` schema, `MailReader` business logic.
- Tutti i nuovi accessi DB passano dal DAL (no `supabase.from()` in UI).
- Token semantici (no colori hardcoded) per pill stati e badge reminder.
