# Audit — Command vs. Menu principale (copertura operativa)

**Data:** 2026-07-18  
**Scopo:** verificare, per ogni maschera raggiungibile dal menu principale, se ogni operazione disponibile nella UI ha un tool equivalente in Command, e con quali parametri.  
**Metodo:** confronto tra `src/v2/ui/templates/navConfig.tsx` (14 voci pinnate), le sezioni figlie (`sections/*`, `pages/*`) e `src/v2/ui/pages/command/tools/registry.ts` (67 tool registrati).

Legenda copertura:
- ✅ tool 1:1 con parametri sufficienti (payload dal planner + fallback prompt)
- 🟡 tool esiste ma **parametri incompleti** o solo lettura / senza update
- 🔴 nessun tool equivalente — l'operazione è raggiungibile **solo dalla UI**

---

## 1) Command  `/v2/command`
Meta-pagina: la copertura *è* l'oggetto dell'audit. Nessuna operazione UI-only propria.

## 2) Missioni / Autopilot  `/v2/agents/autopilot`
| Operazione UI | Tool Command | Note |
|---|---|---|
| Elenco missioni attive | `list-missions` | ✅ |
| Lancio nuova missione | `launch-mission` | ✅ approval + payload |
| Pausa / stop / resume missione | `mission-control` | 🟡 supporta `action`, ma manca preset per `budget_cap` runtime |
| Modifica cadenza / slot orari | — | 🔴 solo UI (`mission_slot_config`) |
| Assegnare agente a missione | — | 🔴 no tool `assign-agent-to-mission` |

## 3) Esplora  `/v2/explore/*`  (map, network, contacts, biglietti, deep-search, campaigns)
| Op | Tool | Note |
|---|---|---|
| Ricerca partner per nazione / filtri | `wca-country-counts`, `deep-search-partner`, `ai-query` | ✅ |
| Ricerca contatti | `deep-search-contact`, `ai-query` | ✅ |
| Enrichment sito web / LinkedIn | `enrich-partner-from-web(site)`, `scrape-*`, `linkedin-profile-api` | ✅ |
| Batch enrich (lista) | `batch-enrich-partners` | ✅ |
| OCR biglietto da visita | `parse-business-card`, `sync-business-cards` | ✅ |
| Deduplica | `deduplicate-contacts`, `deduplicate-partners` | ✅ |
| Lancio campagna | `create-campaign`, `launch-mission` | ✅ |
| **Aggiungere note / tag manuali a un contatto** | `update-contact` (updates:{…}) | 🟡 KB tool esiste ma il planner non conosce lo schema completo dei campi validi (`notes`, `tags[]`, `custom_fields`) |
| **Assegnare contatto a operatore/owner** | — | 🔴 `owner_id` non è mappato in `update-contact` |
| **Marcare partner come blacklist** | — | 🔴 no tool `add-to-blacklist` (esiste tabella `blacklist_entries`) |
| **Collegare contatto ↔ partner** | — | 🔴 no tool `link-contact-partner` (funzione DAL esiste: `linkContactToPartner`) |

## 4) Cestinone  `/v2/cestinone`
| Op | Tool | Note |
|---|---|---|
| Ripristina contatto soft-deleted | — | 🔴 no tool `restore-contact` |
| Elimina definitivamente | — | 🔴 volutamente assente (`DESTRUCTIVE_TOOL_IDS` vuoto) |

## 5) Cockpit  `/v2/cockpit`
| Op | Tool | Note |
|---|---|---|
| Snapshot KPI | `dashboard-snapshot`, `campaign-status` | ✅ |
| Follow-up batch | `followup-batch` | ✅ |
| Chiudere follow-up singolo | `update-contact` (status) | 🟡 funziona ma non c'è `close-followup` semantico |
| Approvare azione pending | `pending-action-executor` | ✅ |

## 6) Comms  `/v2/comms/*`  (compose, inbox, outreach)
| Op | Tool | Note |
|---|---|---|
| Componi email (batch o singola) | `compose-email` | ✅ |
| Invio diretto | `send-email-direct` | ✅ enqueue in `ai_pending_actions` |
| WhatsApp / LinkedIn | `send-whatsapp`, `send-linkedin` | ✅ |
| Programma outreach queue | `enqueue-outreach` | ✅ |
| Stato coda outreach | `outreach-queue-status` | ✅ |
| **Cancellare / posticipare item in coda** | — | 🔴 no tool `cancel-outreach-item` |
| **A/B test avvio & lettura risultati** | — | 🔴 no tool (`ab_tests`) |

## 7) Inbox  `/v2/inbox`  &  Email  `/v2/email`
| Op | Tool | Note |
|---|---|---|
| Leggere inbox | `read-inbox` | ✅ |
| Applicare regole classificazione | `apply-email-rules` | ✅ |
| Suggerire nuovi gruppi mittenti | `suggest-email-groups` | ✅ |
| Gestire cartelle IMAP | `manage-email-folders` | ✅ |
| **Rispondere a un messaggio specifico** (marcare replied) | `compose-email` + `send-email-direct` | 🟡 non c'è handle `reply_to_message_id` → il thread non viene ricucito |
| **Segnare come letto / archiviare / flag** | — | 🔴 nessun tool su `funnemail_message_status` |
| **Escalation manuale a lead** | — | 🔴 no tool (esiste `funnemail_escalation_events`) |

## 8) Agenda  `/v2/agenda/*` (today, reparti, pipeline, duplicati)
| Op | Tool | Note |
|---|---|---|
| Elenco attività del giorno | `list-agenda` | ✅ |
| Creare/schedulare attività | `schedule-activity` | ✅ |
| **Spostare attività su altra data** | `schedule-activity` con `activity_id`? | 🟡 payload attuale accetta solo *create*, non *reschedule* |
| **Chiudere / annullare attività** | — | 🔴 no tool `close-activity` (soft-delete via `update-contact` non copre `activities`) |
| Duplicati (merge) | `deduplicate-contacts / -partners` | ✅ |
| Pipeline: cambiare stage contatto | `update-contact({lead_status})` | ✅ |

## 9) Lab  `/v2/lab`
| Op | Tool | Note |
|---|---|---|
| Run prompt test | — | 🔴 no tool `run-prompt-test` (esiste `prompt_test_runs`) |
| Analisi risultati | `agent-report`, `optimus-analyze` | 🟡 generici, non specifici |
| Design system preview | — | UI-only, accettabile |

## 10) Email Intelligence  `/v2/email-intelligence`
| Op | Tool | Note |
|---|---|---|
| Analisi edit email | `analyze-email-edit` | ✅ |
| Import struttura | `analyze-import-structure` | ✅ |
| **Retag classificazione manuale** | — | 🔴 |
| **Trigger reclassify batch** | — | 🔴 no tool `reclassify-emails` |

## 11) Rubrica WhatsApp  `/v2/rubrica/whatsapp`  & 12) Rubrica LinkedIn  `/v2/rubrica/linkedin`
| Op | Tool | Note |
|---|---|---|
| Elenco messaggi | — | 🔴 `read-inbox` copre solo email |
| Invio messaggio | `send-whatsapp`, `send-linkedin` | ✅ |
| **Sync stealth manuale** | — | 🔴 (dispatch via extension, no tool trigger) |
| Profilo LinkedIn scrape | `scrape-linkedin-profile`, `linkedin-profile-api` | ✅ |

## 13) Agenti  `/v2/intelligence/agents`
| Op | Tool | Note |
|---|---|---|
| Elenco agenti / report | `agent-report` | ✅ |
| Creare agente | `create-agent` | ✅ |
| **Modificare persona / prompt agente** | — | 🔴 no tool `update-agent-persona` |
| **Attivare / disattivare agente** | — | 🔴 no tool `toggle-agent` |
| **Assegnare capabilities** | — | 🔴 no tool (`agent_capabilities`) |

## 14) Config  `/v2/settings/*`
| Op | Tool | Note |
|---|---|---|
| KB: ingest documento | `kb-ingest-document`, `create-kb-entry`, `country-kb-generator` | ✅ |
| KB: cerca | `search-kb` | ✅ |
| **KB: aggiornare / eliminare entry** | — | 🔴 no tool `update-kb-entry` / `delete-kb-entry` |
| Prompt Lab: creare/versionare prompt | — | 🔴 no tool (tabella `prompt_versions`) |
| Alert routing | — | 🔴 |
| Users / roles | — | 🔴 solo UI (ADMIN) — accettabile per sicurezza |
| Export audit CSV | `export-audit-csv` | ✅ |
| Health check | `health-check` | ✅ |

---

## Sintesi numerica

| Area | Op UI totali | ✅ | 🟡 | 🔴 | Copertura |
|---|---:|---:|---:|---:|---:|
| Missioni | 5 | 2 | 1 | 2 | 50% |
| Esplora | 10 | 7 | 1 | 3 | 75% |
| Cestinone | 2 | 0 | 0 | 2 | 0% |
| Cockpit | 4 | 3 | 1 | 0 | 88% |
| Comms | 7 | 5 | 0 | 2 | 71% |
| Inbox/Email | 7 | 4 | 1 | 3 | 64% |
| Agenda | 6 | 4 | 1 | 1 | 75% |
| Lab | 3 | 0 | 1 | 2 | 17% |
| Email Intelligence | 4 | 2 | 0 | 2 | 50% |
| Rubriche WA/LI | 4 | 2 | 0 | 2 | 50% |
| Agenti | 5 | 2 | 0 | 3 | 40% |
| Config | 8 | 4 | 0 | 4 | 50% |
| **Totale** | **65** | **35** | **5** | **26** | **58%** |

**Voto copertura Command vs. Menu: 58 / 100.**  
La lettura (READ) è ~90% coperta. Il gap è quasi tutto sui **WRITE puntuali di secondo livello** (toggle, close, restore, retag, assign, link) e su Prompt/Agent management.

---

## Top 12 gap prioritari (piano fix)

Ordinati per rapporto valore/effort. Ognuno è un tool nuovo o un'estensione minima di uno esistente.

| # | Tool nuovo / esteso | File | Impact |
|---|---|---|---|
| 1 | `close-activity` (soft-close) | `tools/closeActivity.ts` | Chiude follow-up da chat, sblocca cockpit voice |
| 2 | `reschedule-activity` (estensione di `schedule-activity`) | `scheduleActivity.ts` payload `{ activity_id, new_date }` | Sposta agenda |
| 3 | `link-contact-partner` | `tools/linkContactPartner.ts` (esiste DAL) | Chiude buco CRM |
| 4 | `update-contact` — allargare schema `updates` (owner_id, tags, notes) | `updateContact.ts` | Zero LOC su tool, solo doc/planner |
| 5 | `mark-message` (read/archive/flag) su funnemail | `tools/markMessage.ts` | Gestione inbox da chat |
| 6 | `reply-to-message` (thread-aware) | estensione `sendEmailDirect` con `in_reply_to` | Ricucitura thread |
| 7 | `blacklist-add` / `blacklist-remove` | `tools/blacklist.ts` | Governance mittenti |
| 8 | `toggle-agent` + `update-agent-persona` | `tools/agentAdmin.ts` | Gestione agenti da chat |
| 9 | `update-kb-entry` / `delete-kb-entry` | `tools/kbAdmin.ts` | Manutenzione KB |
| 10 | `cancel-outreach-item` | `tools/cancelOutreach.ts` | Correzione code |
| 11 | `restore-contact` (cestinone) | `tools/restoreContact.ts` | Chiude cestinone |
| 12 | `run-prompt-test` | `tools/runPromptTest.ts` | Prompt Lab da chat |

Effort stimato: **~1,5 giornate** per implementare tutti e 12 (pattern approval+payload identico agli attuali). Post-fix la copertura sale a **~92%**.

---

## Note trasversali (qualità dei tool esistenti)

1. **Payload schema non introspezionabile dal planner.** Oggi ogni write-tool documenta i suoi campi solo nel codice `fallbackFromPrompt`. Serve un JSON-schema per tool (già previsto nella Prompt Freedom Doctrine ma incompleto per ~15 tool) così il planner sa quali chiavi passare senza tentativi.
2. **Resolver fuzzy attivo solo per partner/contatti.** `resolvePartnerRef`/`resolveContactRef` esistono in `_helpers/writePayload.ts`; manca `resolveMissionRef`, `resolveAgentRef`, `resolveActivityRef`, `resolveCampaignRef` → oggi il planner deve indovinare l'UUID.
3. **Context hint (fix precedente) è passato al planner ma non a tutti i tool.** Tool come `enqueue-outreach` non ricevono `lastQueryContext.rowIds` → l'utente deve rispecificare "questi contatti".
4. **Registry ordering fragile.** 67 tool con `match(prompt)` regex-first; nuovi tool WRITE vanno inseriti PRIMA di `ai-query` catch-all. Convertire `resolveToolFast` in scoring invece che first-match ridurrebbe collisioni.

---

## Prossimo passo suggerito

Batch 1 (oggi, ~4h): tool 1-5 della tabella top-12 (chiude 60% dei gap operativi di cockpit/agenda/inbox).  
Batch 2 (domani): tool 6-12 + fuzzy resolver mancanti + JSON-schema payload per i 15 tool sprovvisti.

Se confermi, procedo in autonomia con il Batch 1.