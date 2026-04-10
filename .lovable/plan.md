

# Audit Completo: Caccia al Tesoro — Bug, Errori di Architettura, Logica Sbagliata

## 🔴 BUG CRITICI (Rottura funzionale)

### 1. **app_settings: NESSUNA Edge Function filtra per user_id** 
**Gravità: CRITICA** — Vanifica completamente la migrazione fatta 2 sessioni fa.

Il frontend (`useAppSettings.ts`) filtra correttamente per `user_id`. Ma **TUTTE e 12 le Edge Function** che leggono `app_settings` usano il **service_role_key** (che bypassa RLS) e **NON filtrano mai per user_id**:

- `generate-outreach`: `.like("key", "ai_%")` — legge le settings di TUTTI gli utenti
- `generate-email`: `.like("key", "ai_%")` — idem
- `agent-execute`: `.like("key", "ai_%")` — idem  
- `send-email`: `.in("key", ["smtp_host", ...])` — prende la PRIMA riga, potrebbe essere di un altro utente
- `process-email-queue`: stessa cosa per SMTP
- `agent-autonomous-cycle`: `.in("key", [...])` — senza user_id
- `daily-briefing`: `.eq("key", "operative_strategy")` — senza user_id
- `improve-email`: `.like("key", "ai_%")` — senza user_id
- `timeUtils.ts`: `.in("key", [...])` — senza user_id
- `scrape-wca-blacklist`: legge E scrive senza user_id
- `ai-assistant`: `.like("key", "ai_%")` — senza user_id
- `super-assistant`: `.like("key", "ai_%")` — senza user_id

**Risultato**: Un utente invia email con le credenziali SMTP di un altro, vede la KB di un altro, usa l'alias/firma di un altro.

**Fix**: Aggiungere `.eq("user_id", userId)` in OGNI query su `app_settings` in tutte le edge function.

---

### 2. **kb_entries: generate-outreach e generate-email NON filtrano per user_id**
**Gravità: CRITICA**

`fetchKbEntriesForOutreach()` e `fetchKbEntriesStrategic()` leggono tutte le kb_entries attive senza filtrare per user_id. L'utente A ottiene le tecniche di vendita dell'utente B nel suo prompt.

Solo `agent-execute` (riga 90) filtra `.eq("user_id", userId)`.

**Fix**: Aggiungere `.eq("user_id", userId)` alle query KB in outreach, email, improve-email, super-assistant, voice-brain-bridge, e ai-assistant (dove manca).

---

### 3. **sameLocationGuard: `return true` blocca TUTTI gli invii**
**Gravità: CRITICA**

In `sameLocationGuard.ts` riga 66:
```js
const sentToOther = recentActs.find(a => {
  return true; // any recent send to this partner counts
});
```
La funzione `find()` con `return true` matcha SEMPRE il primo elemento. Questo significa che se c'è stata UNA QUALSIASI attività completata verso quel partner negli ultimi 7 giorni, **TUTTI i nuovi invii sono bloccati**, anche se era un follow-up alla stessa persona.

La logica intendeva verificare se il contatto fosse diverso, ma il check è stato sostituito con `return true` — probabilmente un refactoring andato male.

**Fix**: Implementare un check reale basato su `selected_contact_id` o `to_address` per distinguere follow-up (stesso contatto = ok) da invio a nuovo contatto (bloccare).

---

### 4. **generate-outreach fallback model inesistente**
**Gravità: MEDIA**

Riga 493: `models: [model, "openai/gpt-4o-mini"]` — `gpt-4o-mini` NON è nella lista dei modelli supportati. Il fallback non funzionerà mai. Dovrebbe essere `openai/gpt-5-mini` o `openai/gpt-5-nano`.

---

### 5. **scrape-wca-blacklist: upsert senza user_id rompe il vincolo**
**Gravità: MEDIA**

Riga 127: `.upsert({ key: "blacklist_last_updated", value: ... }, { onConflict: "key" })` — Il vincolo unique ora è su `(user_id, key)`, non su `key` da solo. Questo upsert fallirà o creerà duplicati perché manca `user_id`.

---

## 🟡 ERRORI DI ARCHITETTURA

### 6. **agent-autonomous-cycle: settings globali, non per-utente**
Il ciclo autonomo carica settings da `app_settings` SENZA user_id (riga 165-176), poi le applica a TUTTI gli utenti nel loop. Se utente A ha `agent_require_approval = true` e utente B no, il comportamento dipende da quale riga il DB restituisce per prima.

**Fix**: Dentro il loop `for (const [userId, agents] of Object.entries(userAgents))`, caricare le settings per quel `userId` specifico.

### 7. **send-email e process-email-queue: leggono SMTP senza user_id**
Se due utenti hanno configurato SMTP diversi, il sistema usa il primo trovato nel DB. Un utente potrebbe inviare email tramite il server SMTP di un altro.

### 8. **agent-execute: carica agent CON user_id, ma settings SENZA**
Riga 51: `.eq("user_id", userId)` per l'agent — corretto. Ma riga 63: settings senza user_id — le settings caricate nel prompt dell'agente potrebbero essere di un altro utente.

---

## 🟠 LOGICA SBAGLIATA

### 9. **sameLocationGuard: recentContact restituisce dati vuoti**
Righe 72-76: `name: ""`, `email: ""` — il recentContact viene sempre restituito con dati vuoti, rendendo inutile l'informazione per l'utente nel messaggio di errore.

### 10. **generate-email: effectivePartnerId incoerente in standalone mode**
Riga 529: `const effectivePartnerId = isPartnerSource ? activity?.partner_id : partner?.id;`
In standalone mode con `partner_id`, `activity` è `undefined`, quindi `activity?.partner_id` è `undefined` anche se `isPartnerSource` è `true` (riga 490 lo imposta a true). Il guard e le relazioni vengono saltati anche quando i dati ci sono.

### 11. **generate-email: "ISTRUZIONI DAL TIPO EMAIL SELEZIONATO" ripete il goal**
Righe 785-786: 
```
ISTRUZIONI DAL TIPO EMAIL SELEZIONATO:
${goal || "Nessuna istruzione specifica..."}
```
Questo è lo stesso `goal` già usato 3 righe sopra. L'AI riceve lo stesso testo due volte, sprecando token e confondendo il contesto.

### 12. **agent-autonomous-cycle: Phase 2 duplica Phase 1**
Phase 1 (`screenIncomingMessages`) già processa tutti i messaggi inbound non letti. Phase 2 (riga 229-265) rifà la stessa query su `channel_messages` con un filtro aggiuntivo su `lead_status`. Risultato: messaggi duplicati se un partner ha lead_status "contacted" o "in_progress".

Il check anti-duplicazione (riga 247-252) usa `.contains("target_filters", { message_id: msg.id })` che dovrebbe funzionare, ma aggiunge complessità e query inutili.

---

## Piano di Fix

### Step 1: Risolvere l'isolamento user_id nelle Edge Function (CRITICO)
- Passare `userId` a tutte le query su `app_settings` e `kb_entries` in **12 file**
- Per le edge function che ricevono auth header: estrarre userId e usarlo
- Per le edge function cron (es. `agent-autonomous-cycle`): caricare settings per-utente dentro il loop

### Step 2: Fixare sameLocationGuard `return true`
- Implementare il check reale: se `selected_contact_id` corrisponde al contatto attuale → `allowed: true`, altrimenti bloccare

### Step 3: Fixare il modello fallback in generate-outreach
- `gpt-4o-mini` → `openai/gpt-5-mini`

### Step 4: Fixare logica incoerente in generate-email standalone
- `effectivePartnerId` dovrebbe usare `partner_id` (dal body) quando `isPartnerSource && !activity`

### Step 5: Rimuovere la duplicazione ISTRUZIONI/GOAL in generate-email

### Step 6: Fixare upsert in scrape-wca-blacklist

### Stima
- **12+ file da modificare**
- Fix critici (Step 1-2): ~100 righe di codice
- Fix architetturali (Step 3-6): ~30 righe

