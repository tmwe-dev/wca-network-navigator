# Mailbox aziendali condivise + accessi multipli per operatore

## Obiettivo
Trasformare la posta da "1 operatore = 1 casella" a "1 operatore = casella personale + N caselle aziendali condivise (booking, amministrativo, …)". L'admin governa chi accede a cosa; tutti gli operatori vedono e usano sia la propria mail sia le caselle a cui sono autorizzati.

## Modello concettuale

```text
operators (personale, già esistente)
   └── credenziali IMAP/SMTP proprie  → Mailbox "Personale"

shared_mailboxes (NUOVA)
   ├── booking@tmwe.it           (department: 'booking')
   └── amministrazione@tmwe.it   (department: 'admin')
        └── credenziali IMAP/SMTP cifrate (gestite dall'admin in Settings)

operator_mailbox_access (NUOVA, ponte M:N)
   (operator_id, shared_mailbox_id, granted_by, granted_at)
   └── flag booleano implicito: se la riga esiste → accesso attivo
```

Regole d'accesso:
- Ogni operatore ha sempre la propria casella Personale.
- `booking` viene auto-concesso a ogni nuovo operatore al primo login OAuth (trigger DB).
- `amministrativo` solo se l'admin lo abilita manualmente.
- Admin (`is_operator_admin()`) vede tutte le caselle anche senza riga in `operator_mailbox_access`.

## Cosa cambia in ogni layer

### 1. Database (migration)
- **`shared_mailboxes`**: id, slug (`booking`, `admin`), label, email, department, imap_host/user/password_encrypted, smtp_host/user/password_encrypted/port, reply_to, is_active, auto_grant (bool), created_at/updated_at. RLS: SELECT per tutti gli operatori autenticati (servono i metadati per il selettore); INSERT/UPDATE/DELETE solo admin. Le password cifrate non vengono mai mandate al client (colonne escluse via view o policy column-level).
- **`operator_mailbox_access`**: id, operator_id, shared_mailbox_id, granted_by, granted_at. UNIQUE (operator_id, shared_mailbox_id). RLS: SELECT operatore vede le proprie righe + admin vede tutte; INSERT/DELETE solo admin.
- Funzione `get_accessible_mailboxes(p_operator_id uuid)` → ritorna lista `{kind: 'personal'|'shared', id, email, label}` includendo Personale + condivise abilitate (admin: tutte le condivise attive).
- Trigger `on_operator_created_grant_booking`: dopo INSERT su `operators`, inserisce riga in `operator_mailbox_access` per ogni `shared_mailboxes` con `auto_grant = true`.
- Seed: due righe in `shared_mailboxes` per `booking@tmwe.it` (auto_grant=true) e `amministrazione@tmwe.it` (auto_grant=false). Credenziali lasciate NULL: l'admin le inserirà dal pannello Settings (l'edge dirà "credenziali mancanti" finché non sono valorizzate).
- Backfill: inserisce `operator_mailbox_access` per `booking` per tutti gli operatori già esistenti.

### 2. Edge functions (mail)
File toccati: `email-imap-proxy`, `check-inbox`, `mark-imap-seen`, `send-transactional-email`/SMTP sender (solo per leggere le credenziali — la logica di IMAP/SMTP NON cambia, vincolo memoria).
- Aggiungere parametro opzionale `mailbox_id` (uuid di `shared_mailboxes`) o `mailbox_kind: 'personal'|'shared'`. Se assente → comportamento attuale (personale).
- Helper `_shared/resolveMailbox.ts`: dato `(operator_id, mailbox_id?)` verifica accesso (riga in `operator_mailbox_access` o admin) e ritorna le credenziali corrette (decifrate). Blocca con 403 se non autorizzato.
- `email_sync_state` ottiene una colonna nullable `shared_mailbox_id`: la sync per booking è univoca per casella (non per operatore), così l'UID IMAP non si duplica.

### 3. DAL (`src/data/`)
- `src/data/mailboxes.ts` (nuovo): `listAccessibleMailboxes()`, `listSharedMailboxes()` (admin), `upsertSharedMailbox()`, `grantMailboxAccess()`, `revokeMailboxAccess()`, `setOperatorMailboxAccess(operatorId, mailboxIds[])`.
- `src/data/funnemailInbox.ts`, `src/data/funnemail.ts`, eventuali sender: aggiungere parametro `mailboxId?: string` alle query e passarlo alle edge.

### 4. Stato globale: ActiveMailboxContext
- Nuovo `src/contexts/ActiveMailboxContext.tsx` montato in App.tsx accanto a `ActiveOperatorContext`. Memorizza `activeMailboxId` (default: `'personal'`) in `localStorage` per operatore. Espone `mailboxes`, `activeMailbox`, `setActiveMailbox`.
- Hook `useActiveMailbox()` consumato da Funnemail Inbox, Leggi, Scrivi, Cockpit per filtrare/inviare con la casella selezionata.

### 5. Selettore in alto a destra (la voce richiesta)
- Nel dropdown già presente in alto a destra (`LayoutHeader.tsx` → area utente accanto a `OperatorSelector` / Tools / AI), aggiungere una sezione **"Casella di posta"**:
  - Item "📧 Personale (jose@tmwe.it)" — sempre presente.
  - Per ogni mailbox accessibile: "🏢 Booking (booking@tmwe.it)", "💼 Amministrazione".
  - Click → `setActiveMailbox(...)`; check ✓ accanto alla casella attiva.
  - Badge piccolo nel trigger del menu mostra l'iniziale/icona della casella attiva.
- Nessun nuovo selettore separato: tutto dentro lo stesso dropdown utente esistente.

### 6. Settings → Operatori
- In `OperatorsSettingsPanel.tsx`, per ogni riga operatore aggiungere sezione "Accesso mailbox aziendali" con checkbox per ciascuna `shared_mailboxes` attiva. Solo admin può cambiare. La checkbox di booking è marcata per default e — visivamente — "concessa automaticamente" ma rimovibile.
- Nuovo pannello "Mailbox aziendali" (Settings tab): l'admin vede l'elenco di `shared_mailboxes`, può creare/modificare/disattivare, inserire credenziali IMAP/SMTP (form con eye-toggle password, cifratura lato edge prima del salvataggio).

### 7. Onboarding
- Quando l'`OnboardingWizard` completa, oltre a marcare `onboarding_completed=true`, il trigger DB già garantisce l'accesso a `booking`. Aggiungo nel banner una riga: "Accesso automatico a booking@tmwe.it abilitato. L'admin può aggiungere altre caselle (amministrazione, ecc.) dal pannello Operatori."

## File principali toccati
```text
supabase/migrations/<ts>_shared_mailboxes.sql           (nuovo)
supabase/functions/_shared/resolveMailbox.ts            (nuovo)
supabase/functions/email-imap-proxy/index.ts            (param mailbox_id)
supabase/functions/check-inbox/index.ts                 (param mailbox_id)
supabase/functions/mark-imap-seen/index.ts              (param mailbox_id)
src/data/mailboxes.ts                                   (nuovo DAL)
src/data/funnemailInbox.ts, funnemail.ts                (param mailboxId)
src/contexts/ActiveMailboxContext.tsx                   (nuovo)
src/v2/ui/templates/LayoutHeader.tsx                    (sezione mailbox in dropdown)
src/components/settings/OperatorsSettingsPanel.tsx      (checkbox accessi)
src/components/settings/SharedMailboxesPanel.tsx        (nuovo pannello admin)
src/lib/queryKeys.ts                                    (chiavi mailboxes)
```

## Sicurezza & vincoli rispettati
- Soft-delete: `shared_mailboxes` e `operator_mailbox_access` rientrano nel trigger globale di soft-delete.
- RLS RESTRICTIVE su credenziali: colonne `*_password_encrypted` mai esposte al client; cifrate via Vault/edge.
- Niente modifiche alla logica IMAP/SMTP nei file `check-inbox`/`email-imap-proxy`/`mark-imap-seen`: si aggiunge solo il **routing** della credenziale, il flusso di download/parse resta intatto (vincolo memoria "Email Code Integrity").
- Admin sempre privilegiato via `is_operator_admin()`.
- Default booking auto-grant via trigger, non hardcodato nel codice client.

## Out of scope (ora)
- Audit log degli accessi a mailbox condivise (è già coperto in parte da supervisor_audit_log; lo aggiungiamo dopo se serve).
- Pannello permessi granulari per cartella (oggi: accesso = vede tutta la casella).
