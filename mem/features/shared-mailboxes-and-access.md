---
name: Shared Mailboxes & Multi-Mailbox Access
description: Caselle aziendali condivise (booking, amministrazione) con flag accesso per operatore e selettore in header
type: feature
---
- Tabelle: `shared_mailboxes` (caselle aziendali con credenziali IMAP/SMTP cifrate) + `operator_mailbox_access` (M:N).
- Funzione `get_accessible_mailboxes(operator_id)` ritorna Personale + condivise abilitate. Admin vede tutte le condivise attive.
- Trigger `on_operator_created_grant_default_mailboxes`: ogni nuovo operatore riceve auto-grant alle caselle con `auto_grant=true` (default: booking).
- Seed: booking@tmwe.it (auto-grant), amministrazione@tmwe.it (manuale).
- DAL: `src/data/mailboxes.ts`. Context: `ActiveMailboxContext` (per-operator localStorage).
- UI: `MailboxSelector` in `LayoutHeader`; pannello admin "Caselle Aziendali" in Settings; checkbox per-operatore in `OperatorsSettingsPanel`.
- Edge IMAP multi-mailbox attive: `check-inbox`, `email-imap-proxy` (test/fetch/send), `mark-imap-seen` accettano header opzionale `x-mailbox-id`. Senza header → casella personale (legacy invariato). Con header → credenziali via `_shared/resolveMailbox.ts` (mappa slug → ENV `IMAP_PASSWORD_<SLUG>` / `SMTP_PASSWORD_<SLUG>`). `email_sync_state` e `channel_messages` filtrati per `(user_id, mailbox_id)`.
