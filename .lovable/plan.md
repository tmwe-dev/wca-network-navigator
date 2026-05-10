# Pipeline approvazione → invio reale (LI / WA / Email)

## Decisione confermata
**Tutto in coda**, anche i singoli del cockpit. Niente dispatch diretto da `useSendLinkedIn` / `useSendWhatsApp` / "Send" email finché non c'è l'approvazione esplicita in `PendingActionsPanel`.

## Diagnosi degli errori già noti che andremo a sistemare
1. `pending-action-executor` chiama `send-linkedin` / `send-whatsapp` con `Bearer SERVICE_ROLE_KEY`; quelle funzioni fanno `auth.getUser()` → 401 sicuro.
2. Anche se passasse, `send-linkedin` / `send-whatsapp` scrivono nella **coda morta** `extension_dispatch_queue`, che nessuna estensione consuma più (v3.9.56 ascolta solo `from-webapp-li` / `from-webapp-wa`).
3. La logica di invio reale di LI/WA vive **solo** nei bridge browser (`liBridge.sendDirectMessage`, `waBridge.sendWhatsApp`). L'executor server-side non potrà mai chiamarli.
4. `send-email` lato server SMTP funziona, è l'unico canale che può rimanere headless.

## Architettura (riusa, non riscrive)

```
                Cockpit              Bulk / AI proposal
                   │                         │
                   ▼                         ▼
            ┌───────────────────────────────────────┐
            │   enqueueAction()  →  ai_pending_actions │
            │   status='pending', risk gate, audit     │
            └───────────────────────────────────────┘
                              │
                              ▼ click "Approva" in PendingActionsPanel
                ┌─────────────────────────────────┐
                │   useApproveAndDispatch (NEW)   │
                └─────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   send_email           send_whatsapp           send_linkedin
 invoke send-email   waBridge.sendWhatsApp   liBridge.sendDirectMessage
   (server SMTP)      (from-webapp-wa)        (from-webapp-li)
        │                     │                     │
        └─── reviewMessage HARD fail-closed PRIMA di ognuno ──┘
                              │
                              ▼
       UPDATE ai_pending_actions = 'executed'/'failed'
       INSERT supervisor_audit_log + activities (post-send)
```

Le funzioni LinkedIn (hook bridge, edge `send-linkedin`, estensioni, protocollo `from-webapp-*`) **non vengono toccate**: vengono solo riusate come sono.

## Modifiche, in ordine atomico

### Step 1 — Hook unico di enqueue (sostituisce i dispatch diretti)
Nuovo `src/hooks/useEnqueueAction.ts`:
- API: `enqueue({ action_type, payload, partner_id?, contact_id?, suggested_content?, context? })`
- INSERT su `ai_pending_actions` con `status='pending'`, `decision_origin='user_manual'` o `'ai_proposed'`, snapshot del draft.
- Toast: "📥 In coda di approvazione".
- Ritorna l'`id` per eventuale jump alla riga in PendingActionsPanel.

### Step 2 — Cockpit: tutti i send buttons → enqueue
Patch chirurgica a:
- `src/hooks/useSendLinkedIn.ts` → `handleSendLinkedIn` e `handleConnectLinkedIn` chiamano `enqueueAction({ action_type: 'send_linkedin', payload: { recipient: profileUrl, message_text, … } })` invece del bridge diretto. Mantengono ricerca profilo + UI feedback.
- `src/hooks/useSendWhatsApp.ts` → idem con `action_type: 'send_whatsapp'`.
- L'invio email manuale dal cockpit (verifico file esatto durante implementazione, probabile `useSendEmail` / `EmailComposer`) → idem con `action_type: 'send_email'`.
- Nessun bridge chiamato qui. Niente `reviewMessage` qui (rimandato all'approvazione, fonte unica).

### Step 3 — Hook di dispatch on-approve (NEW)
Nuovo `src/hooks/useApproveAndDispatch.ts`:
- Carica `ai_pending_actions` per id.
- Esegue `reviewMessage` (HARD, fail-closed) per `email|wa|linkedin`.
- Switch per `action_type`:
  - `send_email` / `send_proposal` → `supabase.functions.invoke('send-email', …)` con flag `journalist_reviewed:true`.
  - `send_whatsapp` → `waBridge.sendWhatsApp(phone, finalText)`. Se bridge non disponibile / non autenticato → marca `failed` con detail leggibile e fallback clipboard+wa.me.
  - `send_linkedin` → `liBridge.sendDirectMessage(profileUrl, finalText)` (cap 300 char). Stesso fallback clipboard.
- UPDATE `ai_pending_actions` `status='executed'|'failed'`, `executed_at`, `execution_log`.
- INSERT `supervisor_audit_log` con `decision_origin='user_approved'`.
- Side-effects post-send (log activity, increment_partner_interaction) coerenti col cockpit attuale.

### Step 4 — Patch chirurgica `PendingActionsPanel.tsx`
- `approveMutation` per `send_email | send_proposal | send_whatsapp | send_linkedin` chiama `useApproveAndDispatch` invece di `pending-action-executor`.
- Per gli altri tipi (`schedule_followup`, `create_reminder`, `update_lead_status`) resta la chiamata a `pending-action-executor` (quei rami funzionano).

### Step 5 — Pulizia executor edge
`supabase/functions/pending-action-executor/index.ts`:
- Rimuovo i case `send_whatsapp` e `send_linkedin` (impossibili headless, branch ingannevole).
- Tengo `send_email` come fallback per scheduler/cron + fix auth: header `x-cron-secret` o reuse del JWT utente reale invece di passare il service role come Bearer.
- Nessun altro cambio funzionale.

### Step 6 — Side-effect cleanup (atomico, separato)
- `useBulkLinkedInDispatch` già scrive su `ai_pending_actions` → ok, ora avrà un executor reale.
- `agent-execute` (LUCA) `send_whatsapp`/`send_linkedin` già propongono solo (decisione precedente "Mai") → invariato.
- Nessun altro hook va toccato.

## Cosa NON tocco (regola dura)
- `useLinkedInExtensionBridge`, `useWhatsAppExtensionBridge`
- estensioni Chrome / protocollo `from-webapp-*`
- edge `send-linkedin`, `send-whatsapp` (resteranno in stato dormiente; deprecazione coda morta = debito separato già censito)
- `send-email` edge (solo l'invocazione cambia, il codice no)
- schema DB

## Sicurezza / governance
- Editorial review **obbligatorio** al momento dell'approvazione, fail-closed, una volta sola (non duplicato in cockpit + executor).
- Hard guards (`hardGuards.ts`, risk gate) restano attivi sull'INSERT in `ai_pending_actions`.
- Audit trail: `supervisor_audit_log` + `ai_decision_log.user_review='approved'` come oggi.
- RLS invariato: `ai_pending_actions` già protetto per `user_id`.

## Codex Cobra check
- **CLASSIFY**: feature P0 cross-canale, tocca nodo critico "approval pipeline" → modalità chirurgica.
- **DEFENSE**: review hard fail-closed prima di ogni dispatch; nessun bypass.
- **ROLLBACK**: 6 step atomici, ognuno isolato. Step 5 e 2 sono i più rischiosi → mergiati per ultimi e con flag visivo nei toast ("in coda" vs "inviato").
- **VERB**: "enqueue", "approve", "dispatch" — verbi distinti, no overload semantico.
- **ANTI-duplicazione**: zero logica bridge duplicata; `useApproveAndDispatch` è l'unico punto di invio reale per LI/WA.
- **CHANGELOG**: nuova memoria `mem://architecture/approval-dispatch-pipeline-v1` con il diagramma sopra.

## Aspettativa di risultato
1. Apri cockpit, premi "Send" su email/WA/LI → toast "📥 In coda".
2. Vai a PendingActionsPanel → vedi la riga.
3. Premi "Approva" → review parte, poi:
   - email parte via SMTP,
   - WA parte tramite estensione (`from-webapp-wa`),
   - LI parte tramite estensione (`from-webapp-li`).
4. Stato finale `executed`, audit completo.

Pronto a implementare quando approvi.
