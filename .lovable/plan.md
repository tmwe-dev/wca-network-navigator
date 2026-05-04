
# Audit completo: AI, automatismi, routing, classificazione, scheduling

## Scopo
Mappare tutto ciò che decide, scrive, instrada e programma — dire cosa funziona, cosa è duplicato, cosa è muto, cosa va sistemato. Nessuna modifica al codice in questa fase.

## Cosa ho già verificato (snapshot)
- 113 edge function. 19 cron job DB attivi.
- 10.158 messaggi (di cui 7.882 email inbound negli ultimi 30 giorni).
- `email_classifications`: ha solo 1 riga in DB → la pipeline classify gira ma non sta persistendo / non è mai partita davvero sui 7.882 inbound.
- `funnemail_decisions`: 0 righe → il classificatore Funnemail (l'unico che mappa nelle cartelle "to_sort / commerciali / agenda") non è mai stato chiamato sull'inbox reale.
- `agent_tasks`: 2.116 completed, 41 proposed, 17 failed.
- `ai_pending_actions`: praticamente vuota (1 approved, 0 pending).
- 4 contesti email-correlati nei prompt operativi: `classification`, `funnemail_classifier`, `email`, `outreach`.

## Aree da auditare (output del lavoro = un report markdown in `/mnt/documents/`)

### 1. Ingresso email → classificazione
- `check-inbox` → `applyEmailRules` + `classifyInboundEmails` (max 10 per ciclo, fire-and-forget).
- `classify-email-response` (commerciale, 9 stati, lead status guard).
- `classify-inbound-message` (multicanale).
- `funnemail-classify` (smistamento cartelle UI).
- `reply-classifier` (positive/negative/needs_human).
- **Domande chiave**: chi chiama chi, quale è autoritativo, perché `email_classifications` e `funnemail_decisions` sono praticamente vuote nonostante 7.882 inbound, dove si perdono i messaggi.

### 2. Routing post-classificazione
- `postClassificationPipeline` → `emailRouter` (commerciale) / `domainHandler` (operativo, amministrativo, support, internal) / `bounceAndUnsubscribeHandler` / `questionAndComplaintHandler`.
- `EmailProcessManager` + `LeadProcessManager` (event bus).
- **Domande**: ogni categoria ha un handler? quali categorie cadono nel `skip_no_action`? la regola "email commerciale che chiede proposta → genera draft + mette in agenda" è effettivamente cablata?

### 3. Generazione contenuti & editorial review
- `generate-email`, `generate-outreach`, `improve-email`, `analyze-email-edit`, `harmonize-proposal-chat`.
- `journalistReview` obbligatorio (KB).
- Loader unico `operativePromptsLoader` + Prompt Lab.
- **Domande**: tutti i percorsi di scrittura (draft automatico da pipeline, send da `pending-action-executor`, send da composer manuale, follow-up da cadence) passano davvero da journalist? Dove sono i bypass.

### 4. Scheduling & "quando programmare un'attività futura"
Mappatura completa dei 4 motori:
- **`cadence-engine`** (cron orario) — esegue `mission_actions` con `scheduled_at` scaduto.
- **`outreach-scheduler`** (cron 5 min) — drena `outreach_schedules` (FOR UPDATE SKIP LOCKED, batch 20).
- **`smart-scheduler`** (cron giornaliero 5:00) — propone follow-up: stale > 14gg, hot lead score ≥ 50, finestra Mar-Gio 9:00.
- **`agent-autonomous-cycle`** (cron 10 min) — screening inbound + overdue follow-up + transizioni di stato + sequenza primo touch.
- **`reminderManager`** (libreria, chiamata da postSendPipeline) — crea `activities` con sequenza canonica giorni 0/3/7/8/12/16/23.
- **`cadenceEngine` libreria** — regole hard per stato lead (canali ammessi, days between, max/week).

**Domande**: chi è autoritativo su "prossima azione"? Le 4 sorgenti producono duplicati? Quale tabella va consultata dall'operatore (`activities` vs `mission_actions` vs `outreach_schedules` vs `agent_tasks`)? L'agenda mostra tutto?

### 5. Esecuzione & approvazione
- `pending-action-executor` (gate `ai_action_risk` + status='approved' obbligatorio).
- `agent-loop` / `agent-execute` (con tool whitelist e hard guards).
- `aiActionRiskGate` (7 livelli, two-phase commit).
- Pause globale: `app_settings.ai_automations_paused` controllata in 5+ funzioni.
- **Domande**: tutti i write passano dal gate? Ci sono path che bypassano l'approvazione? L'utente vede dove e perché qualcosa è in attesa?

### 6. Holding pattern & lead status
- `applyLeadStatusChange` SSOT (KB).
- 9 stati canonici, transizioni event-driven via `LeadProcessManager.evaluateTimeBasedTransitions`.
- Auto-escalation in `classify-email-response` con `getNextStatusGated`.
- **Domande**: tutte le transizioni passano dal guard? Cosa innesca l'uscita da holding? Ci sono lead bloccati per mancanza di trigger?

### 7. Sicurezza prompt & content
- `promptSanitizer` + `injectionGuard` + `contentNormalizer`.
- `aiInvocationGuard` (Charter): tutto deve passare da `invokeAi()` con scope.
- **Domande**: ci sono ancora chiamate dirette `supabase.functions.invoke` su edge AI dal frontend? (esiste già lo script audit `scripts/audit-ai-invocations.ts`).

### 8. Osservabilità & feedback loop
- `ai_interaction_log` + `ai_message_feedback`.
- `supervisor_audit_log`.
- `edge_metrics` + `cron_run_log`.
- `email_send_log`.
- **Domande**: c'è una pagina che dia in colpo d'occhio "cosa ha fatto l'AI ieri"? cosa è auto vs cosa è stato approvato?

## Output finale
Documento `/mnt/documents/audit-ai-routing-2026-05-04.md` con:
1. **Mappa visuale** del flusso email-in → classificazione → handler → pending action → executor → send → reminder.
2. **Matrice di copertura**: per ogni categoria di email (interested, meeting_request, quote_request, complaint, question, …) → handler? draft? agenda? approval?
3. **Tabella scheduler**: ognuna delle 4 fonti con cosa scrive, dove (tabella), come la vede l'utente, conflitti.
4. **Lista anomalie con priorità**:
   - P0 (bloccante): es. "7.882 inbound ma 1 sola classification → check-inbox limita a 10 e perde il resto, oppure i 10 falliscono silenziosamente".
   - P1 (qualità): handler mancanti, route che cadono in `skip_no_action`, prompt non versionati.
   - P2 (UX): duplicati di reminder, agenda incompleta.
5. **Quick wins** (≤30 min) e **interventi strutturali** (rifattorizzazione PM, dedup scheduler).
6. **Raccomandazioni vincolanti** per memoria progetto.

## Cosa NON faccio in questo task
- Nessuna modifica codice/DB.
- Nessun re-deploy edge.
- Nessun cambio prompt.
Solo report. Le azioni correttive verranno proposte come task separati una volta che approvi le priorità.

## Tempi stimati
- ~25-35 minuti di lavoro: lettura mirata + query DB + cross-reference cron/edge logs ultimi 7gg + scrittura report.
