## Audit: perché il selettore in alto oggi non cambia ciò che vedi

Ho verificato il flusso completo: header → ActiveMailboxContext → /v2/inbox → query DB → sync/mark-read.

### Evidenze principali

1. **/v2/inbox non usa la casella attiva**
   - La pagina `/v2/inbox` monta `InArrivoTab` → `EmailInboxView` → `useChannelMessages("email", ...)`.
   - `useChannelMessages` filtra per canale, ricerca, pagina e operatore, ma **non filtra mai per `mailbox_id`**.
   - Quindi cambiare la casella nel selettore non può cambiare la lista email visibile in `/v2/inbox`.

2. **Funnemail è parzialmente corretto, ma non basta per la Inbox classica**
   - `useFunnemailInbox` e `useFunnemailInboxSidebarData` leggono già `useActiveMailbox()` e passano `mailbox_id` al DAL.
   - La Inbox classica `/v2/inbox`, cioè quella che l’utente sta guardando ora, non è collegata allo stesso filtro.

3. **Il DB conferma il problema di dato/tagging**
   - `channel_messages` contiene **10021 email inbound tutte con `mailbox_id = NULL`**.
   - Le shared mailbox esistono:
     - `booking@tmwe.it`, attiva, auto-grant, 6 operatori abilitati
     - `amministrazione@tmwe.it`, attiva, nessun grant
   - Ma entrambe hanno **0 email taggate** su `channel_messages.mailbox_id`.
   - Quindi anche dove il filtro shared esiste, oggi non può mostrare contenuti finché non viene fatta una sync con header `x-mailbox-id` e credenziali corrette.

4. **Download massivo e auto-sync ignorano la casella attiva**
   - `Scarica nuove` usa `callCheckInbox(mailboxId)` ed è già collegato alla casella attiva.
   - `Download massivo` usa `bgSyncStart()` → `callCheckInbox()` senza mailbox id: scarica sempre la personale.
   - `Auto-sync` chiama `useCheckInbox`, quindi è collegato, ma il singleton di download continuo resta fuori contesto.

5. **Mark-as-read IMAP non passa la mailbox**
   - `useMarkAsRead` aggiorna il DB, poi chiama `mark-imap-seen` senza `x-mailbox-id`.
   - Per una mail condivisa, il DB verrebbe segnato letto, ma il flag `\Seen` verrebbe cercato sulla casella personale e saltato/fallirebbe.

6. **Possibile bug backend nel resync flags**
   - `check-inbox` chiama `resyncUnreadFlags(supabase, imapExec, userId)` senza mailbox id.
   - Dentro `flagResync.ts` la query prende tutte le email unread dell’utente, non solo quelle della mailbox attiva. Con caselle condivise può confrontare UID di una mailbox contro un’altra.

7. **Conteggi/badge non sono mailbox-aware**
   - `useUnreadCount`, `useEmailCount`, `useNavBadgeCountsV2` non filtrano per mailbox.
   - Anche dopo aver filtrato la lista, badge e contatori possono continuare a mostrare numeri aggregati, facendo sembrare il selettore “inefficace”.

## Piano di fix minimo e reversibile

### 1. Collegare `/v2/inbox` alla casella attiva
- In `EmailInboxView`, leggere `useActiveMailbox()` e derivare un filtro mailbox:
  - personale → `mailbox_id IS NULL`
  - condivisa → `mailbox_id = activeMailbox.mailbox_id`
- Estendere `useChannelMessages` con parametro opzionale `mailboxFilter`.
- Aggiornare `queryKeys.channelMessages.list` per includere la mailbox, così React Query refetcha subito quando cambi selezione.
- Resettare pagina e selezione messaggio quando cambia mailbox, per evitare dettaglio/lista stale.

### 2. Rendere coerenti conteggi e badge email
- Estendere `useUnreadCount("email")` con mailbox filter opzionale.
- Estendere `useEmailCount` con mailbox filter opzionale.
- Aggiornare i contatori dentro `InArrivoTab` / `EmailInboxView` in modo che la toolbar mostri i numeri della casella attiva, non il totale globale.
- Lasciare WhatsApp/LinkedIn invariati.

### 3. Passare la mailbox al download massivo
- Modificare `bgSyncStart` per accettare `mailboxId?: string | null`.
- Modificare `useContinuousSync` per leggere `useActiveMailbox()` e chiamare `bgSyncStart(mailboxId)`.
- Mantenere il comportamento legacy se `mailboxId` è assente/null.

### 4. Passare la mailbox al mark-as-read IMAP
- Aggiungere `mailbox_id` al tipo `ChannelMessage` e alle select necessarie.
- In `EmailInboxView`, quando selezioni una mail, chiamare `markAsRead.mutate({ id, channel, user_id, mailbox_id })`.
- In `useMarkAsRead`, se `mailbox_id` è valorizzato, inviare header `x-mailbox-id` a `mark-imap-seen`.

### 5. Correggere il resync flags backend per evitare cross-mailbox
- Estendere `resyncUnreadFlags` con `mailboxId` opzionale.
- In `check-inbox/index.ts`, passare `activeMailboxId`.
- Dentro `flagResync.ts`, filtrare `channel_messages` per:
  - `mailbox_id IS NULL` se personale
  - `mailbox_id = activeMailboxId` se shared

### 6. Verifica dati e funzionamento
- Controllare query reali di `/v2/inbox`: devono contenere `mailbox_id=is.null` per personale e `mailbox_id=eq.<id>` per shared.
- Verificare che cambio selezione invalidi/refetchi la lista.
- Verificare che `Scarica nuove` e `Download massivo` chiamino `check-inbox` con header `x-mailbox-id` quando la casella è condivisa.
- Nota operativa: al momento il DB non contiene email shared già taggate; dopo il fix, selezionando Booking e scaricando nuove email, i nuovi messaggi verranno salvati con `mailbox_id=booking` e la lista inizierà a differenziarsi.