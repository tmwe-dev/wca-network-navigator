# Fase 0.A — Inventario funzionale (registro delle capacità)

Registro unico di **cosa sa fare** il sistema, non di quali file esistono.
Regola: nessun modulo V3 si dichiara completo finché ogni riga di sua competenza non è coperta o esplicitamente archiviata.

## Come leggere le colonne

- **Prova d'uso**: `edge_metrics` (232.760 eventi registrati, dal 2026-05-07 a oggi) e `ai_invocation_audit` (378 righe).
  ⚠️ Attenzione: solo **37 nomi di funzione** compaiono in `edge_metrics`, ma le funzioni deployate sono 150. L'assenza di log **non prova** che una funzione sia morta — prova solo che non è strumentata. Prima di eliminare qualsiasi cosa, la strumentazione va estesa (vedi §5).
- **Destino**: `NUCLEO` (entra in V3) · `LAB` (resta fuori, zona laboratorio) · `DUP di X` (duplicato) · `VERIFICA` (serve prova d'uso prima di decidere).

## Uso reale misurato (finestra completa)

| Funzione | Eventi | Lettura |
|---|---:|---|
| agent-task-drainer | 59.343 | motore task di fatto sempre attivo |
| classify-inbound-message | 35.608 | classificatore in produzione |
| outreach-scheduler | 30.577 | cadenze attive |
| check-inbox | 22.164 | ingest email |
| funnemail-policy-engine | 17.401 | regole inbox |
| funnemail-classify | 15.370 | secondo classificatore |
| funnemail-auto-route | 15.345 | routing inbox |
| classify-inbound-content | 15.341 | terzo classificatore |
| refresh-conversation-context | 15.330 | contesto conversazione |
| agent-autopilot-worker | 5.083 | autopilot |
| generate-email (+ varianti) | ~500 | generazione messaggi |
| journalist-review (varianti) | ~290 | editorial review |
| ai-assistant | 166 | cervello Command |
| ai-query-planner | 112 | pianificatore query |
| generate-outreach (varianti canale) | ~60 | outreach multicanale |
| improve-email, linkedin-ai-extract, daily-briefing | <40 | uso sporadico |

Osservazione chiave: **tre classificatori distinti girano in parallelo sullo stesso flusso in entrata** (`classify-inbound-message`, `classify-inbound-content`, `funnemail-classify`), con volumi dello stesso ordine di grandezza. È la prima duplicazione da sciogliere nel Modulo 4.

---

## 1. Identità & accesso — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Login email+password con whitelist | `authorized_users`, `LoginPage`, `AuthProvider` | in uso quotidiano | NUCLEO |
| Ruoli e permessi (`has_role`, `user_roles`) | RLS + `RBAC_MATRIX` | strutturale | NUCLEO |
| Operatore attivo e mailbox accessibili | `ActiveOperatorContext`, `get_accessible_mailboxes` | strutturale | NUCLEO |
| Impersonation operatore | `impersonation_log`, `StaffPage` | VERIFICA | VERIFICA |
| Consenso OAuth interno | `pages/OAuthConsent`, `/.lovable/oauth/consent` | VERIFICA | VERIFICA |
| Login popup TMWE | `TmweLoginPopupPage` | legato a TMWE | LAB |

## 2. Contatti — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Anagrafica partner/contatti | `partners`, `partner_contacts`, `imported_contacts`, `prospects` | quotidiano | NUCLEO |
| Deduplica contatti e partner | `deduplicate-contacts`, `deduplicate-partners`, `merge_duplicate_*` | strutturale | NUCLEO |
| Soft-delete globale | trigger DB su 15 tabelle + `CestinonePage` | strutturale | NUCLEO |
| Holding pattern (siblings) | `apply_sibling_holding`, `check_sibling_risk` | strutturale | NUCLEO |
| Lead scoring | `calculate-lead-scores`, `calculate-partner-quality` | VERIFICA | NUCLEO |
| Import file / CSV / OCR biglietti | `process-ai-import`, `parse-business-card`, `analyze-import-structure` | periodico | NUCLEO |
| Scraping WCA / ReportAziende / LinkedIn | 23 funzioni `acquisizione` + 4 estensioni browser | VERIFICA | **Resta in V2 per sempre** (D2) — la V3 legge i contatti prodotti |
| Arricchimento sito partner | `enrich-partner-website`, `scrape-website` | VERIFICA | VERIFICA |
| Directory partner e conteggi paese | `wca-country-counts`, `directory_cache` | VERIFICA | NUCLEO |

## 3. Messaggi — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Ingest email IMAP (PEEK obbligatorio) | `check-inbox`, `email-sync-worker`, `email-cron-sync` | 22.164 | NUCLEO |
| Sincronizzazione incrementale e stato | `email_sync_state`, `email_sync_jobs` | attivo | NUCLEO |
| Cartelle IMAP e marcatura letto | `imap-list-folders`, `manage-email-folders`, `mark-imap-seen` | attivo | NUCLEO |
| Allegati email | `email_attachments` | attivo | NUCLEO |
| Ricezione messaggi canale (WA/LI) | `receive-channel-message`, `channel_messages` | VERIFICA | NUCLEO |
| Estrazione contenuto WA/LI da estensione | `whatsapp-ai-extract`, `linkedin-ai-extract` | 35 eventi | NUCLEO |
| Thread e contesto conversazione | `refresh-conversation-context`, `contact_conversation_context` | 15.330 | NUCLEO |
| Webhook consegna e bounce | `email-delivery-webhook`, `apply_email_delivery_event` | attivo | NUCLEO |
| Proxy IMAP esterno | `email-imap-proxy` | VERIFICA | VERIFICA |
| Inbox prenotazioni | `check-inbox-booking` | VERIFICA | VERIFICA |

## 4. Comprensione — NUCLEO (con consolidamento obbligatorio)

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Classificare un messaggio in entrata | `classify-inbound-message` | 35.608 | NUCLEO (canonico) |
| Classificare il contenuto | `classify-inbound-content` | 15.341 | DUP — assorbire nel canonico |
| Classificare per Funnemail | `funnemail-classify` | 15.370 | DUP — assorbire nel canonico |
| Classificazione batch | `classify-emails-batch` | VERIFICA | DUP |
| Regole di routing inbox | `funnemail-auto-route`, `funnemail_routing_rules` | 15.345 | NUCLEO |
| Policy engine inbox | `funnemail-policy-engine`, `funnemail-policy-executor` | 17.401 | NUCLEO |
| Gruppi mittente e regole indirizzo | `apply-email-rules`, `email_sender_groups`, `email_address_rules` | attivo | NUCLEO |
| Suggerire nuovi gruppi | `suggest-email-groups` | VERIFICA | NUCLEO |
| Scout mittente (chi è chi scrive) | `funnemail-scout-sender`, `funnemail_sender_intel` | attivo | NUCLEO |
| Classificare le risposte outreach | `reply_classifications`, `response-pattern-aggregator` | VERIFICA | NUCLEO |
| Apprendere dalle correzioni | `learn-from-group-correction`, `refine-classification-rule`, `save-correction-memory` | VERIFICA | NUCLEO (uno solo) |
| Simulazione ed eval classificatore | `simulate-funnemail-classify`, `run-funnemail-eval` | test | LAB |

## 5. Risposta — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Generare una email | `generate-email` | ~500 | NUCLEO (canonico) |
| Generare messaggio outreach multicanale | `generate-outreach` (email/WA/LI, fast/standard/premium) | ~60 | NUCLEO |
| Editorial review obbligatorio | `review-message` / journalist review | ~290 | NUCLEO — vincolo non negoziabile |
| Migliorare una bozza | `improve-email` | 12 | NUCLEO |
| Layout HTML email professionale | `_shared/emailLayout.ts` | attivo | NUCLEO |
| Invio email | `send-email`, `email_send_log` | attivo | NUCLEO |
| Invio WhatsApp / LinkedIn | `send-whatsapp`, `send-linkedin` | VERIFICA | NUCLEO |
| Autoresponder | `funnemail-send-autoresponder` | VERIFICA | NUCLEO |
| Alias e traduzioni | `generate-aliases`, `translate-text` | VERIFICA | NUCLEO |
| Approvazione umana prima dell'invio | `ai_pending_actions`, `ApprovazioniPage`, `pending-action-executor` | attivo | NUCLEO |
| Generazione contenuti generici | `generate-content` | VERIFICA | VERIFICA |

## 6. Programmazione — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Cadenze e scheduling outreach | `outreach-scheduler`, `cadence-engine`, `outreach_queue` | 30.577 | NUCLEO |
| Scheduling intelligente | `smart-scheduler`, `outreach_timing_templates` | VERIFICA | NUCLEO |
| Code di invio e drenaggio | `process-email-queue`, `email_campaign_queue` | attivo | NUCLEO |
| Promemoria e follow-up | `reminders`, `funnemail-reminders-tick`, `harmonizer_followups` | attivo | NUCLEO |
| Agenda e calendario | `AgendaPage`, `CalendarPage`, `calendar_events` | attivo | NUCLEO |
| Missioni outreach | `mission-executor`, `outreach_missions`, `mission_slot_config` | VERIFICA | NUCLEO |
| Campagne e job di campagna | `campaign_jobs`, `CampaignsPage` | VERIFICA | NUCLEO |
| A/B test messaggi | `ab_tests` | VERIFICA | LAB |
| Alert urgenti | `dispatch-urgent-alert`, `alert_config`, `alert_recipients` | attivo | NUCLEO |
| Integrità dispatch | `dispatch-integrity-check` | attivo | NUCLEO |

## 7. Tracciamento — NUCLEO

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Pipeline / Kanban trattative | `deals`, `deal_activities`, `pipeline/kanban` | attivo | NUCLEO |
| Attività e interazioni per contatto | `activities`, `interactions`, `contact_interactions` | attivo | NUCLEO |
| Log decisionale AI | `ai_decision_log`, `ai_interaction_log`, `ai_invocation_audit` | 378 | NUCLEO |
| Audit azioni | `log-action`, `supervisor_audit_log`, `agent_action_log` | attivo | NUCLEO |
| Metriche edge e osservabilità | `edge_metrics`, `ObservabilityPage`, `TelemetryPage` | 232.760 | NUCLEO |
| Crediti e budget AI | `consume-credits`, `credit_transactions`, `ai_budget_config` | attivo | NUCLEO |
| Briefing giornaliero | `daily-briefing`, `ai_session_briefings` | 1 evento | VERIFICA |
| Export audit | `export-audit-csv` | VERIFICA | NUCLEO |
| KPI e analytics | `AnalyticsPage`, `KpiPage`, `get_dashboard_snapshot` | attivo | NUCLEO |

## 8. Cervello conversazionale — NUCLEO (uno solo)

| Capacità | Dove vive oggi | Prova d'uso | Destino |
|---|---|---|---|
| Chat operativa con tool sul sistema | `ai-assistant` (4.579 righe, 23 file) | 166 | NUCLEO (canonico) |
| Porta d'ingresso proxy | `unified-assistant` | proxy puro | DUP — rimuovere l'hop |
| Pianificatore query | `ai-query-planner` | 112 | NUCLEO (come tool) |
| Ricerca vaga cross-entità | `ai_find_anything`, `ai_field_values` | attivo | NUCLEO (come tool) |
| Grounding KB e mappa app | `appMap.ts`, `kb_entries`, `navBridge` | attivo | NUCLEO |
| Memoria conversazionale | `ai_memory`, `conversation_summaries`, `memory-promoter` | attivo | NUCLEO (una sola) |
| Brain dedicato Command | `command-ask-brain` | nessun log | DUP di ai-assistant |
| Cervello vocale | `voice-brain-bridge` + ElevenLabs | VERIFICA | NUCLEO (stessi tool) |
| Motore condiviso mai adottato | `_shared/assistantEngine.ts`, `toolExecutionLoop.ts`, `platformTools*` | **0 importatori** | MORTA — rimuovere |
| Copilota prompt | `prompt-copilot-chat` | nessun log | LAB |
| Chat proposte harmonizer | `harmonize-proposal-chat` | nessun log | LAB |
| Chat API Findair | `finder-api-chat` | nessun log | LAB → poi tool di Command |

## 9. Laboratorio (resta fuori dal nucleo, non si cancella)

Galassia di sistema · Prompt Lab (atlas, suggestions, proposals, catalog, tests) · AI Arena · AI Test Hub · Harmonizer · Sherlock · `super-mario` · `optimus-analyze` · `decision-dashboard` · Agent autopilot e simulate · KB supervisor e famiglia `kb-*` (10 funzioni) · TMWE/Findair (11 funzioni) · MCP · Globe · Design system preview · E2E status.

Motivazione: sono strumenti di introspezione e sperimentazione. Utili, ma non fanno parte del ciclo del messaggio. La V3 non li ospita; restano raggiungibili dalla V2 finché serve.

## 10. Debito trasversale già misurato

| Problema | Numero | Effetto sulla V3 |
|---|---:|---|
| Rotte V2 registrate | ~150 | in V3 max ~25, una sola per pagina |
| Alias della stessa pagina (es. contatti: `/contacts`, `/crm/contacts`, `/pipeline/contacts`) | molti | eliminati per costruzione |
| Import V3→V1 consentiti | 0 | regola di lint |
| Header di pagina concorrenti | 3 + orfani | 1 solo (`PageFrame`) |
| Classificatori paralleli | 3 | 1 |
| Cervelli conversazionali | 9 | 1 (+ voce che riusa gli stessi tool) |
| Registri prompt | 4 + codice | 1 |

## 11. Prima di ogni cancellazione

1. Estendere `edge_metrics` a tutte le funzioni deployate (una riga di logger per funzione).
2. Osservare 30 giorni.
3. Solo allora una funzione senza eventi e senza chiamanti statici può essere spenta — e resta nel repo un ciclo prima della rimozione.
