---
name: Check-Inbox Flag Re-Sync
description: Re-sync best-effort dei flag \Seen IMAP sulle mail locali ancora unread, eseguito a fine ciclo check-inbox
type: feature
---
# Check-Inbox: Re-sync flag \Seen (2026-05-05)

**Scope**: ad ogni run di `check-inbox`, dopo il fetch dei nuovi messaggi e prima del disconnect IMAP, viene eseguito `resyncUnreadFlags` (file `supabase/functions/check-inbox/flagResync.ts`).

**Comportamento**:
- Query DB: `channel_messages` user/email/inbound, `read_at IS NULL`, `imap_uid NOT NULL`, `created_at >= now() - 60 giorni`, cap 500 (più recenti prima).
- IMAP: `UID FETCH <uids> (FLAGS)` in chunk da 100 (no body, no header).
- Se il server riporta flag `\Seen` → `UPDATE channel_messages SET read_at = now() WHERE id IN (...) AND read_at IS NULL`.
- UID non più presenti (mail spostate/cancellate altrove): nessuna azione distruttiva, nessun soft-delete.
- Tutto best-effort: errori loggati ma non interrompono il flusso.

**Perché solo unread**: per scelta esplicita dell'owner, le mail già lette non vengono ri-verificate (a noi interessa solo sapere se una mail "non letta da noi" è stata in realtà già processata altrove).

**Modifica autorizzata** al constraint "DO NOT MODIFY check-inbox" il 2026-05-05.