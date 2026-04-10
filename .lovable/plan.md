

# Audit Completo — Caccia al Tesoro #2

## 🔴 BUG CRITICI

### 1. **generate-email riga 788-789: Riga duplicata causa errore di sintassi**
Righe 788-789:
```
Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;
Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;
```
La stessa riga di chiusura del template literal è presente DUE VOLTE. Questo produce un errore di sintassi JavaScript — la seconda riga è codice fuori dal template literal. **Il file potrebbe non funzionare affatto.**

---

### 2. **agent-autonomous-cycle righe 177-178: Variabili dichiarate due volte**
```js
const workStartHour = parseInt(globalCfg["agent_work_start_hour"]...);  // riga 174
const workEndHour = parseInt(globalCfg["agent_work_end_hour"]...);      // riga 175
const workStartHour = parseInt(globalCfg["agent_work_start_hour"]...);  // riga 177 — DUPLICATO
const workEndHour = parseInt(globalCfg["agent_work_end_hour"]...);      // riga 178 — DUPLICATO
```
Doppia dichiarazione `const` = errore runtime. **Il ciclo autonomo potrebbe crashare all'avvio.**

---

### 3. **aiGateway.ts ALLOWED_MODELS: modelli obsoleti bloccano le chiamate**
L'allowlist contiene `openai/gpt-4o-mini` e `openai/gpt-4o` che NON sono nella lista dei modelli supportati dalla piattaforma. Ma NON contiene `openai/gpt-5-mini` che è usato come fallback in `generate-outreach` (riga 495) e `agent-execute` (riga 218).

**Risultato**: `generate-outreach` chiama `aiChat({ models: [model, "openai/gpt-5-mini"] })` → `aiGateway` lancia `AiGatewayError("invalid_model")` perché `gpt-5-mini` non è nell'allowlist. **Il fallback non funziona MAI.**

Inoltre, `ai-assistant`, `ai-deep-search-helper` e `voice-brain-bridge` usano ancora `openai/gpt-4o-mini` come fallback.

---

### 4. **timeUtils.ts loadWorkHourSettings: query senza user_id**
Riga 33-36: la funzione `loadWorkHourSettings()` legge `app_settings` SENZA filtrare per `user_id`. Usata da `email-cron-sync`, prende la prima riga trovata che potrebbe essere di qualsiasi utente. **Problema di isolamento dati.**

---

### 5. **agent-autonomous-cycle: query work-hours senza user_id (righe 166-172)**
La query globale per work-hours non filtra per `user_id` — se due utenti hanno orari diversi, il sistema usa il primo trovato. Inoltre, gli orari di lavoro dovrebbero essere per-utente (un utente in Asia, uno in Europa), non globali per il cron job.

---

## 🟡 ERRORI DI ARCHITETTURA

### 6. **logEmailSideEffects: race condition sul contatore interazioni**
Righe 71-84: il codice fa un SELECT del `interaction_count`, poi un UPDATE con `count + 1`. Questo NON è atomico — se due email vengono inviate in parallelo per lo stesso partner, entrambe leggono lo stesso valore e incrementano a N+1 invece di N+2. Dovrebbe usare una `rpc` atomica o `interaction_count + 1` via SQL raw.

---

### 7. **generate-email riga 594: cachedEnrichmentContext usa `activity?.partner_id` in modo incoerente**
```js
if (isPartnerSource && activity?.partner_id) {
```
In standalone mode `activity` è `undefined`, quindi `activity?.partner_id` è sempre `undefined`. Ma `effectivePartnerId` (riga 531) è stato fixato per usare `partner?.id` quando `activity` non c'è. Qui però il blocco di enrichment NON usa `effectivePartnerId` — usa `activity!.partner_id` (riga 598). Risultato: in standalone mode, nessun enrichment data viene caricato anche se il partner esiste.

---

### 8. **Phase 2 di autonomous-cycle duplica Phase 1 (righe 232-275)**
Phase 1 (`screenIncomingMessages`) processa TUTTI i messaggi inbound non letti con `is("read_at", null)`. Phase 2 (riga 239-242) fa la stessa query senza `gte("created_at", lookback)` — prende TUTTI i messaggi non letti, inclusi quelli già processati da Phase 1. Il check anti-duplicazione (riga 257-262) dovrebbe catturare i duplicati, ma genera query N inutili e spreca risorse.

---

### 9. **generate-outreach: partner query senza user_id (riga 139-141)**
La query su `partners` usa solo `ilike("company_name", ...)` SENZA filtrare per utente. I partner sono condivisi per design, MA la query `partner_contacts`, `partner_networks`, `partner_services` ugualmente non filtra per user_id. Se i dati sono condivisi è ok, ma va verificato che questa sia la scelta intenzionale.

---

### 10. **getKBSlice e getKBSliceLegacy: codice duplicato in 3 file**
La stessa funzione `getKBSlice`/`getKBSliceLegacy` esiste in:
- `generate-outreach/index.ts` (righe 42-62)
- `generate-email/index.ts` (righe 100-125)
- `improve-email/index.ts` (righe 28+)

Dovrebbe essere in `_shared/`.

---

## 🟠 LOGICA/PERFORMANCE

### 11. **agent-execute: N+1 query per Director View (righe 171-181)**
Per ogni agente nel team, viene eseguita una query separata per caricare il `system_prompt`. Se ci sono 10 agenti, sono 10 query separate. Dovrebbe fare una singola query `.in("id", agentIds)`.

### 12. **generate-email: `deduct_credits` usa formula diversa**
In `generate-email` (riga 834): `(inputTokens + outputTokens * 2) / 1000` — usa i campi `prompt_tokens`/`completion_tokens` dal response.
In `generate-outreach` (riga 510): stessa formula ma usa `result.usage.promptTokens`/`result.usage.completionTokens` dal wrapper `aiGateway`.
`generate-email` NON usa `aiGateway` — chiama `fetch` direttamente. Nessun retry, nessun fallback model, nessun timeout. **Meno resiliente di `generate-outreach`.**

---

## Piano di Fix

### Step 1 — Bug critici immediati
1. Rimuovere la riga duplicata in `generate-email` (788-789)
2. Rimuovere le variabili duplicate in `agent-autonomous-cycle` (177-178)
3. Aggiornare `ALLOWED_MODELS` in `aiGateway.ts`: rimuovere `openai/gpt-4o-mini` e `openai/gpt-4o`, aggiungere `openai/gpt-5-mini`, `openai/gpt-5`, `openai/gpt-5-nano`
4. Aggiornare i fallback obsoleti in `ai-assistant`, `ai-deep-search-helper`, `voice-brain-bridge` da `gpt-4o-mini` → `gpt-5-mini`

### Step 2 — Isolamento dati
5. Aggiungere `user_id` a `loadWorkHourSettings()` in `timeUtils.ts`
6. Fix query work-hours in `agent-autonomous-cycle` per caricarle per-utente

### Step 3 — Bug logici
7. Fixare `cachedEnrichmentContext` in `generate-email` per usare `effectivePartnerId`
8. Rendere atomico l'incremento `interaction_count` in `logEmailSideEffects`
9. Eliminare la duplicazione Phase 1/Phase 2 in `autonomous-cycle`

### Step 4 — Pulizia e performance
10. Centralizzare `getKBSliceLegacy` in `_shared/`
11. Fixare N+1 query in Director View di `agent-execute`

### Stima
- ~12 file da modificare
- 2 bug sintattici bloccanti (crash runtime)
- 1 bug di allowlist che disabilita tutti i fallback model
- 4 fix logici/architetturali

