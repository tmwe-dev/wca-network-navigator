

# P0.1 — Creare `email_send_log` + retrofit `send-email` & `process-email-queue`

Audit completo salvato in `docs/audit/AUDIT-FLUSSI-FONDAMENTALI-2026-04-24.md`. Procediamo step atomici.

## Cosa fa questo step

Aggiunge **un solo nuovo binario** al sistema email: una tabella audit append-only + due punti di scrittura fire-and-forget. Zero modifiche alla logica esistente di invio.

## 1. Migrazione DB

Nuova tabella `public.email_send_log`:

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid NOT NULL, FK `auth.users(id)` ON DELETE CASCADE | |
| `message_id` | text | Message-ID SMTP (es. `<…@wca-crm.app>`) |
| `idempotency_key` | text | quando presente |
| `recipient_email` | text NOT NULL | |
| `subject` | text NOT NULL | |
| `partner_id` | uuid | nullable, no FK (soft) |
| `activity_id` | uuid | nullable |
| `draft_id` | uuid | nullable |
| `campaign_queue_id` | uuid | nullable, link a `email_campaign_queue.id` |
| `channel` | text DEFAULT `'email'` | |
| `send_method` | text CHECK in (`'direct'`,`'queue'`,`'campaign'`,`'agent'`) | |
| `status` | text CHECK in (`'sent'`,`'failed'`,`'bounced'`,`'rejected'`) | |
| `error_message` | text | |
| `sent_at` | timestamptz NOT NULL DEFAULT `now()` | |

Indici:
- `idx_esl_user_sent_at` su `(user_id, sent_at DESC)`
- `idx_esl_status_partial` su `(status)` WHERE `status <> 'sent'`
- `idx_esl_message_id` su `(message_id)` WHERE `message_id IS NOT NULL` — utile per dedup futura

RLS:
```sql
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esl_select_own" ON public.email_send_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "esl_insert_own_or_service" ON public.email_send_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
```
Service role bypassa RLS (usato dagli edge): nessuna policy aggiuntiva serve.

Niente UPDATE/DELETE policy: append-only by design.

## 2. Retrofit `supabase/functions/send-email/index.ts`

Due punti di scrittura, entrambi fire-and-forget (nessun `await` che blocchi la response, errore loggato in console e basta).

**Punto A — successo SMTP** (subito dopo `await client.send(sendOptions)` riuscito, prima di `runPostSendPipeline`):
```ts
supabase.from("email_send_log").insert({
  user_id: userIdEarly,
  message_id: messageIdExternal,
  idempotency_key: idempotency_key ?? null,
  recipient_email: to,
  subject,
  partner_id: partner_id ?? null,
  channel: "email",
  send_method: agent_id ? "agent" : "direct",
  status: "sent",
}).then(({ error }) => { if (error) console.error("[send-email] esl insert failed:", error.message); });
```

**Punto B — fallimento SMTP** (dentro il `catch (smtpErr)`, dopo `console.error`):
```ts
supabase.from("email_send_log").insert({
  user_id: userIdEarly,
  idempotency_key: idempotency_key ?? null,
  recipient_email: to,
  subject,
  partner_id: partner_id ?? null,
  channel: "email",
  send_method: agent_id ? "agent" : "direct",
  status: "failed",
  error_message: errMsg.slice(0, 1000),
}).then(({ error }) => { if (error) console.error("[send-email] esl insert (fail) failed:", error.message); });
```

Nessuna modifica a:
- blacklist guards
- journalist review
- idempotency su `email_campaign_queue`
- post-send pipeline
- response shape

## 3. Retrofit `supabase/functions/process-email-queue/index.ts`

Dentro il loop `for (const item of queueItems)`, due insert fire-and-forget:

**Punto A — dopo `client.send` riuscito** (subito dopo `await supabase.from("email_campaign_queue").update({status:"sent",...})`):
```ts
supabase.from("email_send_log").insert({
  user_id: userId,
  recipient_email: item.recipient_email,
  subject: item.subject,
  partner_id: item.partner_id ?? null,
  draft_id,
  campaign_queue_id: item.id,
  idempotency_key: item.idempotency_key ?? null,
  channel: "email",
  send_method: "campaign",
  status: "sent",
}).then(({ error }) => { if (error) console.error("[pq] esl insert failed:", error.message); });
```

**Punto B — nel `catch (err)` del send**:
```ts
supabase.from("email_send_log").insert({
  user_id: userId,
  recipient_email: item.recipient_email,
  subject: item.subject,
  partner_id: item.partner_id ?? null,
  draft_id,
  campaign_queue_id: item.id,
  idempotency_key: item.idempotency_key ?? null,
  channel: "email",
  send_method: "campaign",
  status: "failed",
  error_message: errorMsg.slice(0, 1000),
}).then(({ error }) => { if (error) console.error("[pq] esl insert (fail) failed:", error.message); });
```

Nessuna modifica a:
- pause/cancel handling
- idempotency dedup
- batch size, delay
- finalizzazione draft

## 4. Deploy

Dopo le modifiche, deploy di entrambe le edge: `send-email`, `process-email-queue`.

## Verifiche post-step

1. Migrazione applicata, tabella visibile con `SELECT count(*) FROM email_send_log;` → 0.
2. Invio email di test dal Composer → 1 riga `status='sent'` in `email_send_log` con `message_id` valorizzato.
3. Invio con SMTP credenziali volutamente sbagliate → 1 riga `status='failed'` con `error_message`.
4. RLS: query da utente non proprietario non vede i record.
5. Build TS pulito, types regenerati automaticamente.

## Cosa NON è incluso in P0.1
- Dashboard observability (richiede questa tabella ma è un feature separato).
- Modifiche a `useEmailComposerV2`, `useSendEmail`: continuano a funzionare invariati.
- Cambi su V1 legacy.
- P0.2 e P0.3 (faremo dopo conferma).

## Rischi
- Minimo. Insert in fail-soft, niente FK rigida verso `partners`/`activities` per non bloccare insert con id orfani.
- `auth.users` FK con CASCADE: se cancelli un utente, sparisce il suo log → coerente con privacy.

