## Audit gestione email — Findings & Piano

### Stato attuale (audit)

**A. Funnemail Inbox per casella** — ✅ OK
- `useFunnemailInbox` legge `useActiveMailbox()` e passa `mailboxFilter` al DAL.
- `listFunnemailGroupedInbox` filtra `channel_messages.mailbox_id IS NULL` (personale) o `= id` (condivisa).
- I tab "Tutte / Non lette" funzionano lato client.

**B. Badge contatori in sidebar (`useUnreadCountsV2`)** — ❌ GAP
- Conta `channel_messages` non lette **globalmente**, ignora la mailbox attiva. Operatore con accesso a 3 caselle vede sempre lo stesso numero, indipendentemente da dove è entrato.

**C. Classificazione AI su mail storiche** — ❌ GAP CRITICO
- Trigger DB `trg_on_inbound_message` (AFTER INSERT WHEN direction='inbound') chiama `classify-inbound-message` per **ogni** email inbound inserita, inclusi backfill massivi.
- Conseguenza: scaricando le mail di Booking/Iman/Luigi (anche vecchie), parte AI su migliaia di messaggi → costo, rumore, decisioni Funnemail su roba che nessuno leggerà.
- Esiste anche `funnemail-backfill-inbound` (manuale, dry_run di default) — non è il problema principale, ma va lasciato off.

**D. Suggerimenti gruppi su mittenti già categorizzati** — ⚠️ PARZIALE
- `suggest-email-groups`: filtra `group_id IS NULL` ✅, ma non controlla `group_name IS NOT NULL` (campo legacy compilato dalle vecchie classificazioni). Risultato: alcuni mittenti categorizzati via legacy possono ricomparire.
- `AISuggestionsTab` ha `statusFilter` "uncategorized/categorized/all" basato solo su `group_id`.
- `useGroupingData` già esclude `group_id IS NULL AND group_name IS NULL` ✅.
- KPI "Da classificare" e "Suggerimenti AI" già intersecano con allowlist mailbox (recente) ✅.

**E. Pipeline post-classificazione** — ✅ OK, niente da toccare
- `classify-inbound-message` → `funnemail-classify` → `funnemail-auto-route` → `funnemail-policy-engine`. Tutta la catena è idempotente per `message_id`.

---

### Piano interventi (minimi, non rompono comportamento)

**1. Stop classificazione AI su mail già lette / storiche** *(nodo critico — fix mirato sul trigger DB)*
- Migrazione che aggiorna `public.on_inbound_message()` aggiungendo, prima del `PERFORM net.http_post(...classify-inbound-message)`, due short-circuit:
  - skip se `NEW.read_at IS NOT NULL` (la mail era già `\Seen` su IMAP → l'utente l'ha già vista, non serve smistarla);
  - skip se `NEW.email_date < (now() - interval '48 hours')` (cuscinetto contro download massivi retroattivi).
- Effetto: il prossimo download di Booking/Iman/Luigi importa tutte le mail nel DB ma l'AI parte solo sulle nuove non lette. Comportamento real-time invariato.
- **Niente** modifica al resto del trigger (outreach reply tracking, activities, dedup) — chirurgico.

**2. Badge sidebar mailbox-aware**
- `src/v2/hooks/useUnreadCountsV2.ts`: aggiungere dipendenza da `useActiveMailbox` e filtrare `channel_messages` su `mailbox_id IS NULL` / `= activeMailbox.mailbox_id`. Query key invalidata al cambio casella.
- Nessun impatto su `pendingTasks` / `pendingQueue` (restano globali — sono cross-mailbox per natura).

**3. Suggerimenti AI: escludere anche legacy `group_name`**
- `supabase/functions/suggest-email-groups/index.ts`: nella `buildAddressQuery`, oltre a `.is("group_id", null)` aggiungere `.is("group_name", null)`. Una riga.
- `AISuggestionsTab` `statusFilter === "uncategorized"`: stesso filtro combinato.
- Effetto: zero proposte su mittenti già messi in un gruppo (anche legacy).

**4. UI Funnemail — indicatore mailbox attiva**
- Sotto `PageTitleHeader` aggiungere riga sottile "Casella: {activeMailbox.label}" così l'operatore sa sempre su quale account sta smistando. Pure presentazione, niente logica.

---

### Tecnico — file toccati

- **DB migration**: `on_inbound_message()` — solo guardia `read_at IS NOT NULL OR email_date < now() - 48h` davanti al `PERFORM net.http_post`.
- **`src/v2/hooks/useUnreadCountsV2.ts`** — filtro mailbox.
- **`supabase/functions/suggest-email-groups/index.ts`** — filtro `group_name IS NULL`.
- **`src/components/email-intelligence/AISuggestionsTab.tsx`** — filtro `group_name IS NULL` su `statusFilter === "uncategorized"`.
- **`src/v2/ui/pages/FunnemailInboxPage.tsx`** — sotto-header con label mailbox attiva.

### Cosa NON tocco

- `check-inbox` / `email-imap-proxy` / `mark-imap-seen` (memoria: intoccabili).
- `funnemail-classify`, `funnemail-auto-route`, policy engine (logica già corretta).
- `email-cron-sync` (appena messo a posto).
- Trigger su outreach reply / activities / partner timeline (continua a funzionare per tutte le inbound, anche vecchie — serve per il CRM).
- Email Intelligence: regole/gruppi restano condivisi per design.

### Check di accettazione

- Scarico massivo Booking → 0 chiamate AI sulle mail più vecchie di 48h o già `\Seen`; le nuove non lette vengono classificate normalmente.
- Operatore commuta fra Booking e personale → badge sidebar cambia.
- Funnemail "Suggerimenti AI" non propone più mittenti già in un gruppo (group_id o group_name).
- Header Funnemail mostra la casella attiva.
