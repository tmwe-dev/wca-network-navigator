## Diagnosi (audit)

Ho seguito tutta la catena `auth → operatore → casella → query inbox`. Le cause sono multiple e si sommano: si parla di **isolamento per-utente mai applicato**.

### Catena attuale e dove si rompe

```text
AuthProvider (user.id = Luigi)
   │
   ├─ useCurrentOperator()     ← queryKey: ["operators","current"]   ⚠ NON scoped per user.id
   │     restituisce ancora Luca dal cache TanStack precedente
   │
   ├─ useOperators()           ← queryKey: ["operators","all"]       ⚠ NON scoped per user.id
   │     mostra dropdown con la lista di un altro account
   │
   ├─ ActiveOperatorContext
   │     STORAGE_KEY = "activeOperator:v1"                            ⚠ globale, NON per user.id
   │     activeId persiste tra logout/login di utenti diversi
   │     → activeOperator = Luca
   │
   ├─ ActiveMailboxContext
   │     queryKey = queryKeys.email.mailboxes                         ⚠ globale, NON per user.id
   │     listAccessibleMailboxes() chiamato senza operatorId
   │     storage key ancorato a opId vecchio → mailbox stale
   │
   └─ useFunnemailInbox
         targetUserId = activeOperator?.user_id ?? user?.id
         → essendo activeOperator = Luca, l'inbox di Luigi mostra
           messaggi con user_id = Luca. SINTOMO ESATTO.
```

Cause radice (in ordine di gravità):

1. **Cache React Query non isolata per user.id** → `useCurrentOperator`, `useOperators` (e tutte le `queryKeys.operators.*`) sopravvivono al cambio di account.
2. **`activeOperator:v1` localStorage globale** → la scelta di un account "contagia" gli account che fanno login dopo nello stesso browser.
3. **`ActiveMailboxContext.queryKey` globale + parametro `operatorId` non passato** → cache mailbox condivisa tra utenti.
4. **Nessun reset al `SIGNED_OUT`/cambio user.id** in nessuno dei due context: lo stato in memoria e in localStorage non viene mai pulito.
5. **`useFunnemailInbox` si fida ciecamente di `activeOperator.user_id`** anche quando questo è incoerente con la sessione corrente.

## Obiettivo

Quando un utente fa login, deve vedere SOLO il suo ambiente (operatore, mailbox, inbox) finché non sceglie esplicitamente di impersonare un altro operatore (e solo se admin). Nessuna contaminazione tra account sullo stesso browser.

## Fix proposto (strategia)

### A. Scope del cache TanStack per user.id

In `src/lib/queryKeys.ts` aggiungere a tutte le chiavi sensibili al contesto-utente un segmento `user.id`. Esempio:

```text
queryKeys.operators.current(userId)   // ["operators","current", userId]
queryKeys.operators.all(userId)       // ["operators","all", userId]
queryKeys.email.mailboxes(userId)     // ["email","mailboxes", userId]
```

Aggiornare i 3 hook che le usano (`useOperators`, `useCurrentOperator`, `ActiveMailboxContext`) leggendo `useAuth().user?.id` ed `enabled: !!userId`.

### B. ActiveOperatorContext → per-user

- `STORAGE_KEY` diventa `activeOperator:v2:${user.id}`.
- Al `SIGNED_OUT` (o cambio `user.id`): reset di `activeId`/`viewingAll` a default e rimozione della chiave del vecchio user.
- Hard guard: se `activeId` non corrisponde a nessun operatore della lista accessibile dell'utente corrente → fallback a `currentOp` (mai a un id "fantasma").

### C. ActiveMailboxContext → per-user e per-operator

- `STORAGE_KEY` diventa `lov:active-mailbox:v2:${user.id}:${operator.id}`.
- Reset al `SIGNED_OUT`/cambio user.
- `listAccessibleMailboxes()` riceve `currentOp.id` esplicito (no più null implicito).
- `enabled` legato a `user.id && currentOp.id`.

### D. AuthProvider → invalidate globale al logout

In `AuthProvider`, su evento `SIGNED_OUT` (o cambio `user.id` rispetto al precedente):
- `queryClient.clear()` (purge completo del cache TanStack: previene leak tra account).
- Pulizia delle chiavi `lov:active-mailbox:*` e `activeOperator:*` non legate al nuovo user.

Per farlo introduco un piccolo `useAuthLifecycle()` montato in `App.tsx` che ascolta `useAuth().event` e usa `useQueryClient()`.

### E. Hardening lato consumer

- `useFunnemailInbox`: prima di usare `activeOperator.user_id` verifica che `activeOperator.id` sia presente nella lista `operators` dell'utente corrente (cioè: l'admin sta davvero impersonando, non è un dato stale). Se non lo è, ignora `activeOperator` e usa `user.id`.
- `OperationalContextSelector`: nasconde il dropdown finché `useCurrentOperator` non è risolto per il `user.id` corrente (evita flash di un account precedente).

## Cosa NON tocco

- RPC `get_accessible_mailboxes` e `get_current_operator_id`: già corrette, usano `auth.uid()`.
- RLS su `operators` / `shared_mailboxes`: già corrette.
- Logica di invio/lettura email a valle: il fix è puramente "wiring" del contesto.
- Wizard di onboarding e nodi critici (submit, send, AI orchestratori).

## File previsti

- `src/lib/queryKeys.ts` — chiavi per-user.
- `src/hooks/useOperators.ts` — uso `user.id` nelle queryKey + `enabled`.
- `src/contexts/ActiveOperatorContext.tsx` — storage per-user + reset su logout + guard.
- `src/contexts/ActiveMailboxContext.tsx` — storage per-user/operator + parametro RPC esplicito.
- `src/providers/AuthProvider.tsx` (o nuovo `src/providers/AuthLifecycle.tsx`) — `queryClient.clear()` al logout/cambio user.
- `src/v2/hooks/useFunnemailInbox.ts` — guard su `activeOperator` valido.
- `src/components/header/OperationalContextSelector.tsx` — gating di rendering.

## Verifica post-fix

1. Login come Luigi → inbox Funnemail mostra solo messaggi con `user_id = Luigi` e `mailbox = luigi@tmwe.it`.
2. Logout → login come Luca → inbox Luca, dropdown senza tracce di Luigi.
3. Da admin (Luca) impersono Luigi → vedo l'ambiente Luigi; tornando "Tutti gli operatori" o ricliccando Luca, lo stato si aggiorna.
4. localStorage ispezionato dopo logout: nessuna chiave `activeOperator:*` riferita a un user diverso da quello loggato.

Confermi che procedo con questo piano?