
# Audit Autorizzazione & Visibilità Email

## TL;DR — perché Luigi vede le email "di Luca"

**Non è un buco di RLS.** È che la casella `booking@tmwe.it` viene scaricata via IMAP *tre volte* (una per operatore che la polla con le proprie credenziali), salvando ogni messaggio inbound con `operator_id = chi ha pollato` e `mailbox_id = NULL`. Risultato:

- 4.953 messaggi `mailbox_id=NULL, operator_id=Luca`
- 2.598 messaggi `mailbox_id=NULL, operator_id=Imane`
- 2.508 messaggi `mailbox_id=NULL, operator_id=Luigi`
- 43 messaggi correttamente taggati con `mailbox_id=booking`

Quindi la "stessa email arrivata su booking" appare a ciascun operatore come fosse sua personale → Luigi vede *la sua copia* di un'email che Luca ha scritto/ricevuto, non la riga DB di Luca. La RLS di `channel_messages` (vedi sotto) blocca correttamente la riga di Luca, ma la triplicazione fa percepire un leak.

## Stato attuale del modello

```
auth.users  ──1:1──>  operators (id, email, is_admin, is_active, user_id)
                          │
                          ├── operator_mailbox_access(operator_id, shared_mailbox_id)
                          └── shared_mailboxes(id, email, ...)

profiles    →  VUOTA per luca/luigi/imane (RBAC V2 su profiles è morto)
```

Funzioni RLS chiave (security definer):
- `get_current_operator_id()` → `operators.id` di `auth.uid()`
- `is_operator_admin()` → `operators.is_admin = true`
- `get_active_operator_id()` → admin può impersonare via GUC `app.active_operator_id`
- `get_effective_operator_ids()` → **admin ⇒ TUTTI gli operatori attivi**, non-admin ⇒ solo se stesso

Operatori attuali (admin in grassetto): **luca@tmwe.it**, **jose@tmwe.it**, luigi, imane, jose.local, luca@gmail, pietro.

## Findings RLS

| # | Tabella | Policy | Severità | Problema |
|---|---|---|---|---|
| 1 | `channel_messages` | SELECT `operator_id = ANY get_effective_operator_ids()` | OK | Funziona; admin vede tutto by design |
| 2 | `funnemail_decisions` | SELECT `qual: true` | **ALTO** | Tutti gli auth vedono TUTTE le decisioni AI: `subject`, `from_address`, `partner_id`, `reasoning`, `urgency`. Meta-leak completo della inbox altrui anche se i body sono protetti |
| 3 | `outreach_queue` | SELECT `qual: true` | **ALTO** | Ogni operatore legge `subject`, `body`, `recipient_email` di tutta la pipeline outreach degli altri |
| 4 | `partners`, `partner_contacts` | SELECT `qual: true` | Atteso (Shared Contact Policy) | Visibilità globale voluta per CRM, ma include `email`/`phone` |
| 5 | `email_send_log` | SELECT `user_id = auth.uid()` | OK | Isolato per utente |
| 6 | `email_drafts`, `email_address_rules` | SELECT `operator_id = ANY get_effective_operator_ids()` | OK | Coerente |
| 7 | `shared_mailboxes` | SELECT `deleted_at IS NULL` | Tollerabile | Lista caselle condivise visibile a tutti gli auth, ma niente segreti IMAP nel payload |
| 8 | `operator_mailbox_access` | SELECT `is_admin OR operator_id = ANY get_effective_operator_ids()` | OK | |

## Findings architetturali

**A. Polling IMAP per-operatore della stessa casella condivisa** (root cause del sintomo)
- `check-inbox` salva `operator_id = chi polla` invece di risolvere `mailbox_id` quando l'host/user IMAP coincide con uno `shared_mailboxes.imap_user`.
- `mailbox_id` è `NULL` nel 99% dei record inbound → la UI Funnemail non riesce a presentare la "casella condivisa Booking" come stream unico, e ogni operatore vede solo i propri 2.5k duplicati.
- Verifica: `get_accessible_mailboxes` restituisce Booking a Luigi (grazie a `operator_mailbox_access`), ma `listFunnemailGroupedInbox(..., {kind:"shared", id: booking})` filtra `mailbox_id = booking` → trova solo i 43 record taggati.

**B. `funnemail_decisions` aperta**
- Le decisioni AI contengono già subject + from + reasoning. Aprirle a `true` è equivalente a esporre l'inbox altrui in chiaro, anche con `channel_messages` chiusa.

**C. Profili RBAC V2 non popolati**
- Memoria di progetto cita `profiles.operator_role` come fonte di ruoli; in realtà nessuna riga profili per gli operatori reali. Tutta l'auth gira su `operators.is_admin`. Path `profiles` è codice morto da pulire o popolare.

**D. Admin = wildcard a livello DB**
- Per design `get_effective_operator_ids()` apre tutto agli admin. Nessun audit trail quando l'admin "impersona" via `app.active_operator_id`. Ok per oggi, ma se Luigi viene promosso admin per errore vede tutto senza notifica.

**E. Nessuna policy RESTRICTIVE su `funnemail_decisions`**
- Anche aggiungendo policy permissive future, basta una `qual:true` esistente per vanificare tutto.

## Piano di remediation (proposto, ordine di priorità)

### P0 — Chiudere il meta-leak Funnemail
1. **Migrazione SQL**: sostituire `funnemail_decisions SELECT qual:true` con
   `EXISTS (SELECT 1 FROM channel_messages cm WHERE cm.message_id_external = funnemail_decisions.message_id AND cm.operator_id = ANY(get_effective_operator_ids()))`.
2. Stessa logica per `funnemail_actions_log`, `funnemail_message_status`, `funnemail_message_status_history`, `funnemail_message_reminders`, `funnemail_escalation_events` (audit rapido dei `qual:true` su tutte le tabelle `funnemail_*`).
3. Aggiornare `countFunnemailByFolder` se i conteggi devono restare globali per admin (già coperto da `get_effective_operator_ids` admin).

### P0 — Chiudere `outreach_queue`
4. Sostituire `outreach_queue_select_all_authenticated` con
   `operator_id = ANY(get_effective_operator_ids()) OR created_by = auth.uid()`.
5. Verifica edge functions che leggono la coda con anon key: devono usare service role o il filtro spezza l'esecuzione.

### P1 — Risolvere il sintomo "stessa email triplicata"
6. **Backfill** `channel_messages.mailbox_id`: matchare `to_address`/`raw_payload[Delivered-To]` contro `shared_mailboxes.email`; popolare `mailbox_id` e dedupe per `(mailbox_id, message_id_external)` mantenendo la riga più recente.
7. **Dedup constraint**: unique partial `(mailbox_id, message_id_external) WHERE mailbox_id IS NOT NULL`.
8. **Fix `check-inbox`**: prima di insert, se `imap_user ∈ shared_mailboxes` → setta `mailbox_id` e `operator_id = NULL` (o `operator_id = mailbox.owner_operator_id`). Cambiare RLS di `channel_messages` per consentire visibilità anche via `mailbox_id ∈ accessible mailboxes`:
   ```
   SELECT USING (
     (operator_id = ANY get_effective_operator_ids())
     OR (mailbox_id IN (SELECT mailbox_id FROM get_accessible_mailboxes(NULL)))
   )
   ```
9. **Schedulare il polling shared in un solo edge runner** invece di 1 cron per operatore (no più triplicazione futura).

### P2 — Hardening RBAC
10. Pulire/popolare `profiles.operator_role` o rimuovere ogni riferimento dal codice e dalla memoria.
11. Audit log su admin impersonation (`app.active_operator_id`): trigger su `operators` o wrapper RPC che logga in `supervisor_audit_log`.
12. Test E2E: `RLS_visibility.spec.ts` che, autenticato come Luigi, conta righe visibili in `channel_messages`/`funnemail_decisions`/`outreach_queue` per `operator_id = Luca` → atteso 0.

### P2 — Memoria/documentazione
13. Aggiornare `mem://security/user-isolation-and-rbac-v2` con il modello reale (operators-based) e la nuova policy Funnemail.
14. Aggiornare `mem://business/shared-contacts-visibility-policy` chiarendo che `outreach_queue` NON è "shared".

## Cosa NON va toccato
- `channel_messages` policy SELECT esistente (è quella corretta).
- `partners`/`partner_contacts` shared (scelta di business documentata).
- `email_send_log` (per-utente OK).
- Logica `is_operator_admin` / `get_effective_operator_ids` (admin = wildcard è scelta).

## Output dell'approvazione
Eseguirò in 3 migration distinte:
1. `funnemail_*` SELECT lockdown (atomica, rollback semplice).
2. `outreach_queue` lockdown.
3. `channel_messages` mailbox-aware policy + backfill + fix `check-inbox` (più rischiosa, va isolata per ultima — tocca un nodo critico, faccio mappa impatto separata prima di partire).
