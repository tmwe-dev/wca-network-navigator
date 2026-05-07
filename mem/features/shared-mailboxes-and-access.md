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
- TODO futuro: passare `mailbox_id` a check-inbox/email-imap-proxy/mark-imap-seen + helper `_shared/resolveMailbox.ts`. Ad oggi le edge usano ancora solo le credenziali personali dell'operatore.
