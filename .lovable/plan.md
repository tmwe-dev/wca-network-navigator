## Feature 1/4 (backlog Funnemail) — Pulsante "Lo prendo io"

Obiettivo: ogni email/job nella inbox può essere "presa in carico" da un operatore. L'azione registra **chi** e **quando**, mostra un badge sulla card e impedisce che altri operatori lavorino in parallelo sullo stesso messaggio. Reversibile (rilascio).

### Cosa fa l'utente
1. Sulla card di un'email (lista Funnemail) compare un pulsante "✋ Lo prendo io".
2. Click → la card mostra `Preso da @Mario · 12:34` con avatar/iniziali; il pulsante diventa "Rilascia".
3. Operatori diversi vedono il claim in tempo reale (subscription Realtime su tabella claim).
4. Apertura `MailReader`: se claim di un altro, banner giallo "In carico a Mario da X minuti — apri in sola lettura / forza presa in carico".

### Dati (nuova tabella, NON tocca tabelle email esistenti)

```text
funnemail_message_claims
  message_id  text PK            -- IMAP Message-ID (stessa chiave di funnemail_actions_log)
  group_id    uuid               -- folder/group corrente (per RLS scope)
  claimed_by  uuid not null      -- auth.uid()
  claimed_at  timestamptz default now()
  released_at timestamptz null   -- soft-release (per audit)
  user_id     uuid not null      -- owner originale del mailbox (RLS)
```

- RLS: `SELECT` a tutti gli operatori autenticati (visibilità globale claim, allineata a doctrine "Visibilità Globale Agenti"); `INSERT/UPDATE/DELETE` solo a `claimed_by = auth.uid()` **oppure** admin (`has_role('admin')`) per il "force-claim".
- Soft-delete trigger globale già attivo → conserva storico release.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE`.

### DAL (nuovo file)
`src/data/funnemailClaims.ts`
- `claimMessage({ messageId, groupId })` → upsert con guardia "already-claimed-by-other".
- `releaseMessage(messageId)` → set `released_at = now()`, allow re-claim.
- `forceClaim({ messageId, groupId })` → solo admin, rilascia il vecchio + nuovo claim atomico (RPC).
- `listClaimsForGroup(groupId)` → mappa `messageId → { claimedBy, claimedAt, displayName }`.
- Hook `useFunnemailClaims(groupId)` con React Query + canale Realtime.

### UI (solo presentazione, niente business logic in componenti)
1. **`FunnemailMailCard.tsx`** — badge "✋ @Mario · 12 min" in alto a destra; bottone "Lo prendo io" se libero, "Rilascia" se mio. Stati gestiti dall'hook `useMessageClaim(messageId)`.
2. **`MailReader.tsx`** — banner alert in cima quando `claim.claimedBy && claim.claimedBy !== userId`; CTA "Forza presa in carico" visibile solo agli admin.
3. **`FunnemailMailList.tsx`** — passa `claimsMap` dall'hook ai children.
4. Tokens design system (no colori hardcoded): `bg-warning/10 text-warning` per banner, `bg-primary/10 text-primary` per badge proprio.

### Non faccio
- Nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (constraint memoria).
- Nessun cambio a `MailReader` business logic (solo banner + CTA che chiamano DAL).
- Nessun edge function nuovo (force-claim è una RPC SQL `force_claim_message(message_id, group_id)` con `security definer` + check `has_role('admin')`).
- Niente touch a `funnemail_actions_log` / `funnemail_decisions`.

### Tecnico

```text
migration:
  - CREATE TABLE funnemail_message_claims (...)
  - RLS policies (SELECT all auth, INSERT/UPDATE self, force_claim via RPC)
  - CREATE FUNCTION force_claim_message(p_message_id text, p_group_id uuid)
      RETURNS void SECURITY DEFINER
      WHERE has_role(auth.uid(), 'admin')
  - ALTER PUBLICATION supabase_realtime ADD TABLE funnemail_message_claims
  - INDEX (group_id) WHERE released_at IS NULL

src/data/funnemailClaims.ts          (nuovo, DAL)
src/lib/queryKeys.ts                 (+ funnemailClaims keys)
src/v2/ui/hooks/useFunnemailClaims.ts (nuovo, query + realtime sub)
src/v2/ui/hooks/useMessageClaim.ts    (nuovo, mutations claim/release)
src/v2/ui/pages/funnemail-inbox/FunnemailMailCard.tsx  (+ badge + bottone)
src/v2/ui/pages/funnemail-inbox/FunnemailMailList.tsx  (passa claimsMap)
src/v2/ui/pages/funnemail-inbox/MailReader.tsx         (+ banner read-only/force)
```

### Check finali
- batch/dedup/ordine inbox invariati (claim è layer parallelo).
- realtime: claim altrui appare entro 1-2s.
- force-claim solo admin (verifica via `has_role`).
- soft-delete: trigger globale OK, audit conservato in `released_at`.
- RLS testata: 2 operatori diversi vedono lo stesso badge.
- nessuna regressione su `MailReader`: la logica di lettura email resta invariata, banner aggiuntivo non blocca apertura.

### Memoria
A fine implementazione aggiorno `mem://features/funnemail-claim-system` con: tabella, RPC, hook, regola "force-claim solo admin".
