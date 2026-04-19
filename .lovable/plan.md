

# Riscrittura Costituzione Unica — Piano operativo

Questo è un intervento **trasversale critico**: cambia la tassonomia degli stati lead in tutto il sistema (DB, edge functions, UI, AI prompts). Procedo nell'ordine fornito perché le dipendenze sono reali.

## Pre-flight: verifiche di mappatura legacy → nuova tassonomia

**Mappa migrazione stati esistenti → nuovi:**

| Vecchio | Nuovo | Note |
|---|---|---|
| `new` | `new` | invariato |
| `contacted` | `first_touch_sent` | semantica equivalente |
| `in_progress` | `holding` | semantica equivalente (era già "in attesa risposta") |
| `qualified` | `engaged` o `qualified` | DA DECIDERE per record esistenti — uso `engaged` come default conservativo |
| `negotiation` | `negotiation` | invariato |
| `converted` | `converted` | invariato |
| `lost` | `archived` | semantica equivalente |
| n/a | `blacklisted` | nuovo, solo manuale |

**Migration DB necessaria** (non era nel prompt utente ma è obbligatoria, altrimenti UI esplode):
- `UPDATE partners SET lead_status = CASE ... END`
- `UPDATE imported_contacts SET lead_status = CASE ... END`
- `UPDATE business_cards SET lead_status = CASE ... END`
- `UPDATE ra_prospects SET lead_status = CASE ... END`
- Aggiornare `sync_bca_lead_status_to_partner()` (la funzione DB ha hardcoded l'ordine `new < contacted < in_progress < negotiation < converted` — va riscritta con i 9 nuovi stati).

## Sequenza esecuzione (11 prompt + migration + side-effects)

### FASE A — Foundation (Prompts 1-2 + Migration DB)

**Step 1: Migration DB**
- Mappare i lead_status esistenti sui nuovi nomi (4 tabelle: `partners`, `imported_contacts`, `business_cards`, `ra_prospects`).
- Riscrivere `sync_bca_lead_status_to_partner()` con il nuovo ordering: `new(0) < first_touch_sent(1) < holding(2) < engaged(3) < qualified(4) < negotiation(5) < converted(6)`. `archived` e `blacklisted` sono terminali, no auto-escalation.

**Step 2: Tassonomia TS (Prompt 1)**
- `src/data/contacts.ts` → `LeadStatus` con 9 valori
- `src/types/ra.ts` → `RALeadStatus` con 9 valori
- `src/constants/holdingPattern.ts` → aggiornare `HOLDING_STATUSES` = `["first_touch_sent", "holding", "engaged"]`, `ALL_LEAD_STATUSES` = nuovi 9
- `src/components/global/filters-drawer/constants.ts` → `COCKPIT_STATUS` e `CRM_LEAD_STATUS` aggiornati
- `src/lib/leadEscalation.ts` → nuove costanti + statusMap
- **Side-effects da aggiornare**: tutti i posti dove sono hardcoded `"contacted"`, `"in_progress"`, `"lost"`. Faccio grep e sistemo (badge, color helpers, transition arrays, RPC params).

**Step 3: Luca Director (Prompt 2)**
- UPDATE riga `agents` WHERE `name='Luca'`: `system_prompt`, `assigned_tools`, `knowledge_base.tags`.

### FASE B — AI Prompts (Prompts 3-4-10)

**Step 4-6: Modifica `supabase/functions/_shared/scopeConfigs.ts`**
- Aggiunge VINCOLI COMMERCIALI a `COCKPIT_PROMPT`
- Sostituisce `CONTACTS_PROMPT`
- Sostituisce `STRATEGIC_OPERATIVE_PROMPT`

### FASE C — Cadence & Gate (Prompts 5-6-7)

**Step 7: agent-execute (Prompts 5+6+7)**
- Identifico la sezione "cadence rules" e la sostituisco con la sequenza 23gg G0/G3/G7/G8/G12/G16/G23.
- WhatsApp gate: blocco se `state < engaged` AND non whitelist.
- Post-invio hook: dopo ogni `send_email`/`send_linkedin_message` → update status `new → first_touch_sent`, `INSERT activities` con `status='pending'` per next step.
- Crea `supabase/functions/_shared/stateTransitions.ts` (file non esiste ancora, lo creo da zero) con le transition gates approvate.

### FASE D — Templates (Prompts 8-9)

**Step 8: `src/data/agentTemplates/templates.ts`**
- Sostituisco `systemPrompt` template Outreach + tools ridotti
- Sostituisco `systemPrompt` template Sales/Vendite

### FASE E — Oracolo unificato (Prompt 11) ⚠️ BREAKING

**Step 9: Riarchitetto `composeSystemPrompt()`**
- Aggiungo `CONTEXT_ENGAGEMENT_RULES` dopo `COMMERCIAL_DOCTRINE` in `supabase/functions/ai-assistant/systemPrompt.ts`.
- Aggiungo parametro `scope` a `ComposeSystemPromptOptions` (così il blocco regole per scope viene iniettato).
- **Rimuovo** i prompt scope-specific da `scopeConfigs.ts`: ogni scope ora espone solo `{ tools, temperature, model }`. Il prompt è uno solo.
- Aggiorno tutti i caller di `scopeConfigs` (probabilmente `ai-assistant/index.ts` e altri orchestratori) per:
  - non leggere più `config.systemPrompt`
  - chiamare `composeSystemPrompt({ scope, operatorBriefing, activeWorkflow })`

Questo è il punto più delicato: se sbaglio, l'AI risponde senza contesto. Faccio prima un'analisi di tutti i caller di `getScopeConfig()` per trovare ogni punto da aggiornare.

## File toccati (~25)

**Migration DB (1)**
- Nuova migration con UPDATE su 4 tabelle + riscrittura `sync_bca_lead_status_to_partner()`.

**Tassonomia (5)**
- `src/data/contacts.ts`
- `src/types/ra.ts`
- `src/constants/holdingPattern.ts`
- `src/components/global/filters-drawer/constants.ts`
- `src/lib/leadEscalation.ts`

**AI Prompts (3)**
- `supabase/functions/_shared/scopeConfigs.ts`
- `supabase/functions/ai-assistant/systemPrompt.ts`
- (eventuali caller di `getScopeConfig` da aggiornare — censimento durante esecuzione)

**Edge functions logica (2)**
- `supabase/functions/agent-execute/index.ts`
- `supabase/functions/_shared/stateTransitions.ts` (NUOVO)

**Templates (1)**
- `src/data/agentTemplates/templates.ts`

**Side-effects (~10)**
- File con hardcoded `"contacted"`, `"in_progress"`, `"lost"`: badge color helpers, status helpers, transition guards, dashboard queries, holding pattern hooks. Censimento via grep durante esecuzione.

**DB diretto (1 query)**
- `UPDATE agents SET system_prompt=..., assigned_tools=... WHERE name='Luca'`

## Rischi noti & mitigazione

1. **Stati legacy in DB non migrati** → la migration UPDATE corregge tutto in un colpo solo, idempotente.
2. **`sync_bca_lead_status_to_partner()` con ordering hardcoded** → riscrittura della funzione nella stessa migration.
3. **Caller di `getScopeConfig` che si aspettano `systemPrompt`** → li trovo via grep prima di rimuovere il campo, e li aggiorno tutti nello stesso commit.
4. **UI status badges con switch su `"contacted"/"in_progress"/"lost"`** → grep + replace mirato. Ogni occorrenza viene sistemata.
5. **Filtri salvati in localStorage con vecchi valori** → fallback nel reducer: se `filters.cockpitStatus === "contacted"` lo mappiamo a `"first_touch_sent"` lato UI per non rompere sessioni esistenti.

## Verifica finale (eseguita al termine)

- `grep -rn '"contacted"\|"in_progress"\|"lost"' src/ supabase/functions/_shared supabase/functions/agent-execute supabase/functions/ai-assistant` → solo commenti legacy/migration headers.
- Query DB: `SELECT DISTINCT lead_status FROM partners` → solo i 9 nuovi stati.
- Query DB: `SELECT name, length(system_prompt), jsonb_array_length(assigned_tools) FROM agents WHERE name='Luca'` → prompt > 200 char, tools > 0.
- `scopeConfigs.ts` non contiene più export `*_PROMPT`.
- `composeSystemPrompt({scope:'cockpit'})` produce un prompt che contiene "9 stati" e "scope=cockpit".

## Nota operativa

Procedo end-to-end senza ulteriori conferme intermedie come da preferenza utente. Userò il task tracker per monitorare le 5 fasi (A-E). Ogni fase chiusa = task `done`. Al termine consegno un riepilogo verifica con i risultati di tutti gli check.

