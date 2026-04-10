
# Audit Completo — Caccia al Tesoro #4

## 🔴 BUG CRITICI

### 1. **email-cron-sync riga 29: `loadWorkHourSettings(supabase)` senza userId**
La funzione cron chiama `loadWorkHourSettings(supabase)` SENZA passare un userId. In `timeUtils.ts` riga 37: `if (userId) query = query.eq("user_id", userId)` — senza userId, prende la PRIMA riga trovata tra TUTTI gli utenti. Se l'utente A ha orari 6-24 e l'utente B ha 9-18, il cron potrebbe usare gli orari di A per decidere se fare sync per TUTTI.
**Fix**: Il cron itera già gli utenti (riga 52). Spostare il check work-hours DENTRO il loop per-utente.

### 2. **agent-autonomous-cycle righe 166-176: work-hours globali senza user_id**
Stessa identica problematica. Carica orari di lavoro GLOBALMENTE (senza user_id) e poi li applica PRIMA del loop per-utente (riga 199). Risultato: se il primo utente trovato ha orari 6-24, il sistema opera per tutti; se ha 9-18, blocca tutti alle 18 anche chi ha configurato 6-24.
**Fix**: Spostare il work-hours check dentro il loop per-utente, usando il loro userId.

### 3. **generate-email: raw fetch() senza timeout/retry/fallback (riga 765)**
`generate-email` chiama `fetch("https://ai.gateway.lovable.dev/...")` direttamente. NESSUN:
- Timeout (AbortController)
- Retry con backoff
- Fallback model cascade
In contrasto, `generate-outreach` usa `aiChat()` con tutto questo. Se il modello primario è sovraccarico, `generate-email` FALLISCE. L'utente riceve un errore 500 senza recupero.
**Fix**: Migrare a `aiChat()` dal gateway condiviso.

### 4. **agent-execute: raw fetch() senza timeout (righe 232-236, 290-294)**
Il loop di fallback models usa `fetch()` nudo. Se una chiamata si blocca, l'edge function resta in stallo fino al timeout del runtime (300s su Supabase). Nessun AbortController.
**Fix**: Aggiungere AbortController con timeout 45s per ogni chiamata.

---

## 🟡 RACE CONDITIONS

### 5. **agent-execute righe 338-348: stats update non atomico**
```js
const stats = (agent.stats as any) || {};
const updatedStats = { ...stats };
updatedStats.tasks_completed = (stats.tasks_completed || 0) + 1;
await supabase.from("agents").update({ stats: updatedStats }).eq("id", agent_id);
```
Se due task dello stesso agente terminano in parallelo, entrambi leggono `stats.tasks_completed = 5`, entrambi scrivono `6` invece di `7`. Pattern identico al bug #6 del precedente audit (interaction_count).
**Fix**: RPC atomica `increment_agent_stat`.

### 6. **process-email-queue righe 220-223: sent_count non atomico**
```js
const { data: currentDraft } = await supabase.from("email_drafts").select("sent_count")...
await supabase.from("email_drafts").update({ sent_count: (currentDraft?.sent_count || 0) + 1 })...
```
Non è un vero rischio perché il queue è processato sequenzialmente per draft. Ma se due invocazioni concorrenti elaborano lo stesso draft, il conteggio si perde.

---

## 🟠 SICUREZZA

### 7. **send-email riga 104-109: query agente senza filtro user_id**
```js
const { data: agentRow } = await supabase
  .from("agents")
  .select("signature_html, ...")
  .eq("id", agent_id)
  .single();
```
Un utente autenticato che passa un `agent_id` di un ALTRO utente caricherà la firma di quell'agente. Manca `.eq("user_id", userId)`.

### 8. **agent-autonomous-cycle: findAgentForPartner riga 62-66 query partner senza user scope**
```js
const { data: partner } = await supabase
  .from("partners")
  .select("country_code")
  .eq("id", partnerId)
  .single();
```
I partner sono condivisi per design, ma la query successiva su `client_assignments` (riga 50-55) filtra correttamente per `user_id`. OK per architettura attuale, ma va documentato.

---

## 🟢 MIGLIORAMENTI ARCHITETTURALI

### 9. **generate-email duplica la logica di firma con generate-outreach**
Entrambi costruiscono `signatureBlock` con la stessa logica (righe 668-680 in generate-email, righe 513-525 in generate-outreach). Dovrebbe essere in `_shared/`.

### 10. **agent-execute: KB globale caricata SENZA limit (riga 89-93)**
```js
const { data: kbEntries } = await supabase.from("kb_entries").select(...)
  .eq("is_active", true).order("priority", { ascending: false });
```
Nessun `.limit()` — se un utente ha 200 KB entries, tutte vengono caricate nel context. Questo può superare il token limit del modello e rallentare drasticamente l'esecuzione.
**Fix**: Aggiungere `.limit(50)` e/o troncare il contenuto.

---

## Piano di Fix

### Step 1 — Work-hours per-utente (Bug #1, #2)
- email-cron-sync: spostare check inside per-user loop
- agent-autonomous-cycle: spostare check inside per-user loop

### Step 2 — Resilienza AI (Bug #3, #4)
- generate-email: migrare a `aiChat()` dal gateway
- agent-execute: aggiungere AbortController con timeout

### Step 3 — Race conditions (Bug #5, #6)
- agent-execute: creare RPC `increment_agent_stat`
- process-email-queue: usare RPC per sent_count

### Step 4 — Sicurezza (Bug #7)
- send-email: aggiungere `.eq("user_id", userId)` alla query agente

### Step 5 — Performance (Bug #10)
- agent-execute: aggiungere limit alla query KB entries

### Stima
- 5 file da modificare
- 1 migrazione DB (RPC increment_agent_stat)
- 2 bug di isolamento work-hours
- 1 bug di resilienza AI critico
- 1 bug di sicurezza cross-tenant
