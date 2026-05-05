# Piano CODEX — Repair P0/P1 (Audit Consolidato 2026-05-05)

## Classe: CRITICAL
Tocca auth, service-role, ownership, Edge Functions sensibili, credenziali, cookie, invii, classificazioni, CI. **PR atomiche, modifiche minime, reversibili. Niente refactor opportunistici.**

## Decisioni utente confermate
1. **agent-execute → ownership stretta SÌ**: solo l'owner può eseguire un agente. Ma l'agente, una volta in esecuzione, opera su tutti i contatti/partner (visibilità globale). Le risorse strettamente private restano: email, messaggi, draft, download job, cookie/credenziali, agent_tasks/runs dell'agente.
2. **Trigger `on_ai_pending_action_approved`**: invariato (anon-key fa solo il fan-out; l'executor PR-4 farà ownership check interno).
3. **PR-1 per prima** (ownership guard + 7 edge).

### Matrice ownership (regola sintetica per CODEX)
| Risorsa | Scope | Note |
|---|---|---|
| `agents` (execute/update/delete) | `user_id == caller` | SELECT resta globale |
| `email_drafts`, `email_campaign_queue`, `outreach_queue`, `outreach_schedules` | `user_id == caller` | privato |
| `download_jobs`, `import_logs` | `user_id == caller` | privato |
| `channel_messages`, `email_*` (read/write) | `user_id == caller` | privato |
| `partners`, `partner_contacts`, `imported_contacts` | **globale** | nessun filtro user_id |
| `wca/ra/linkedin sessions` | `user_id == caller` | nuovo per-user (PR-2) |
| `operators`, `email_rules` | `operator owned by caller` | via `get_effective_operator_ids()` |

---

## P0 — 15 bloccanti verificati

### PR-1 · Ownership Guard (`_shared/ownership.ts`) — PRIMA
Helper riusabili (Result pattern, no throw nascosti):
```
requireUser(req)                     → JWT utente verificato (getClaims)
requireServiceOrUser(req)            → service-role + header interno firmato OPPURE user JWT
assertOwnedBy(table, id, userId)
assertAgentOwned(agentId, userId)
assertOperatorOwned(operatorId, userId)
assertMessageOwned(messageId, userId)
assertDraftOwned(draftId, userId)
assertJobOwned(jobId, userId)
```
**Nessun guard su partner/contact** (visibilità globale confermata).

Applicazione a 7 edge in PR-1:
- **#1 agent-execute** → `validateAgent` con `.eq("user_id", userId)`
- **#10 analyze-partner** → richiedi user JWT + audit log scrittura (no ownership su partner)
- **#11 classify-inbound-message** → service-role solo con header interno + `user_id` esplicito; user JWT path con `assertMessageOwned`
- **#12 classify-inbound-content** → idem #11
- **#13 process-email-queue** → `assertDraftOwned` su pause/cancel/load/queue
- **#14 process-download-job** → `assertJobOwned`
- **#15 apply-email-rules** → `assertOperatorOwned` + `assertMessageOwned` per ogni id

### PR-2 · Extension auth + cookie scoping
- **#3** Rimuovere fallback `token === anonKey` da `_shared/extensionAuth.ts`. Audit chiamanti `authMethod === "anon-key"`.
- **#4 save-wca-cookie** → tabella `user_wca_sessions(user_id PK, encrypted_cookie, status, checked_at)` + RLS owner-only.
- **#5 save-ra-cookie** → analoga `user_ra_sessions`.
- **#6 save-linkedin-cookie** → analoga `user_linkedin_sessions`.
- Lettori (`/get-*-cookie`, `extensionAuth`) aggiornati a leggere prima dalla tabella per-user, fallback `app_settings` 1 release.

### PR-3 · Segreti mai al browser
- **#7 #8 #9** `get-wca-credentials`, `get-ra-credentials`, `get-linkedin-credentials` → rimuovere `password` dal payload.
- Nuovi endpoint `*-login-internal` lato server: eseguono login, salvano cookie scoped (PR-2), ritornano solo `session_status`.
- Aggiornare bridge extension per non aspettarsi più `password`.

### PR-4 · Contratto chiamate interne Edge
Estrarre core logic in helper interni (no roundtrip HTTP, no JWT mismatch):
```
_shared/internal/sendEmailInternal.ts
_shared/internal/sendWhatsappInternal.ts
_shared/internal/sendLinkedinInternal.ts
_shared/internal/classifyEmailResponseInternal.ts
_shared/internal/classifyInboundMessageInternal.ts
```
Endpoint pubblici (`send-email`, `send-whatsapp`, `send-linkedin`, `classify-*`) restano user-JWT-only e chiamano l'helper.
Caller interni:
- **#2 pending-action-executor** → `sendEmailInternal({userId})` (userId da `ai_pending_actions.user_id`).
- **#16 check-inbox/postProcessing** → `classifyEmailResponseInternal` (no HTTP, no JWT mismatch). **Non si tocca `check-inbox/index.ts`**, solo `postProcessing.ts`.
- **#17 classify-emails-batch** → carica messaggio completo da DB (subject/body/from/channel) e chiama `classifyInboundMessageInternal` con payload completo.
- Trigger DB `on_ai_pending_action_approved`: invariato (decisione utente).

---

## P1 — 5 verificati

### PR-5 · Lock atomico drainer
- **#19 agent-task-drainer** → RPC `acquire_agent_tasks(p_limit)` con `FOR UPDATE SKIP LOCKED` (modello `acquire_outreach_batch`).

### PR-6 · CORS/Security headers consistency
- **#18 classify-emails-batch** → fix `getCorsHeaders(req)` + `getSecurityHeaders(corsH)`. Grep su altre edge per stesso anti-pattern.

### PR-7 · consume-credits trasparenza
- **#20** Quando kill-switch OFF: header `X-Limits-Disabled: true` esplicito. Auth check sempre eseguito prima di rispondere `allowed: true`.

---

## Architettura / Runtime — 4 verificati

### PR-8 · Provider deduplication
- **#21** Nuovo `AppProviders.tsx` (QueryClient, Tooltip, GlobalFilters, ContactDrawer, toaster, drawer). Montato solo in `main.tsx`/`App.tsx`. `AuthenticatedLayout` rimosso da provider duplicati.

### PR-9 · Diagnostica read-only
- **#22** Sostituire POST `_diagnostic_ping` con GET `?_health=1`. Ogni edge: short-circuit pre-auth se GET `_health` → `{ok, name, ts}`. `useDiagnosticsRunner` → solo GET.

### PR-10 · PWA cache safe
- **#23** Rimuovere caching runtime per `/rest/v1/` e `/functions/v1/` da `vite.config.ts`. Cache solo asset statici/immagini.

### PR-11 · Logger redaction centrale
- **#24** Nuovo `src/lib/redact.ts` (denylist: password, token, cookie, authorization, smtp, secret, apikey, body_html, otp). Applicato in `log.ts` PRIMA di console e `remoteSink`.

---

## CI

### PR-12 · CI realmente bloccante
- **#25** Rimuovere `|| true` da `lint:public`, `typecheck:public`, `npm audit --audit-level=high`, Playwright smoke critici, deno test edge. Marcare blocking nel workflow.

---

## Test matrix obbligatoria

**Cross-user**
- B non esegue agent di A (404)
- B non pausa/cancella draft di A
- B non completa download job di A
- B non applica email rules su messaggi di A
- B non classifica inbound message di A
- (atteso) B PUÒ leggere/operare su partner/contact di A — visibilità globale

**Credentials/Cookies**
- anon-key rifiutata da `extensionAuth`
- cookie WCA/RA/LinkedIn scoped per `user_id`
- `get-*-credentials` non restituiscono `password`

**Internal calls**
- `pending-action-executor` send_email approvata → invio tracciato sull'utente corretto
- `check-inbox` → classify coerente
- `classify-emails-batch` payload completo

**Side effects**
- diagnostics non invia, non consuma crediti, non salva cookie, non processa queue

**Lock**
- 2 drainer paralleli → ogni task acquisita una sola volta

**Routing smoke (Playwright)**
- `/v2/command`, `/v2/settings/diagnostics`, `/v2/email`, `/v2/explore/network`

## Soglie rollback (per PR, post-deploy 10 min)
- auth error rate > 2%
- 403/404 anomali agent-execute > 5%
- pending-action failure > 5%
- invii duplicati > 0
- cookie/sessione cross-user > 0
- queue email bloccata > 10 min
→ revert PR singola.

## Ordine di esecuzione
1. **PR-1** ownership guard + 7 edge (PRIMA, confermato)
2. **PR-2** extension auth + cookie scoping
3. **PR-3** no plaintext credentials
4. **PR-4** helper interni send/classify
5. **PR-5** drainer RPC lock
6. **PR-6** CORS fix + **PR-7** consume-credits doc
7. **PR-8** provider dedup + **PR-9** diagnostics + **PR-10** PWA + **PR-11** redaction
8. **PR-12** CI gating

## Documentazione finale
- `mem/security/p0-p1-repair-2026-05-05.md` (registro PR + verifiche)
- `mem/architecture/ownership-guard-helper.md` (SSOT)
- `mem/reference/email-pipeline-repair-2026-05-05.md` (aggiornato PR-4)
- Aggiornare `mem/index.md`

Ogni PR richiede tua conferma prima del commit.
