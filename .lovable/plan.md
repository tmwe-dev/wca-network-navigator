# Audit deep pipeline produzione/invio messaggi

Ho mappato riga per riga ogni punto del codice che produce o invia un'email/WhatsApp/LinkedIn e ogni passaggio è stato confrontato con la pipeline ufficiale (Oracolo → Architetto → Prompt Lab → Knowledge Base → **Giornalista (caporedattore finale)** → Send).

## Sintesi: pipeline rispettata? Quasi, ma ci sono 5 buchi reali

✅ **OK** — `generate-email`, `improve-email`, `send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue`, `agent-execute · send_email`, `agent-execute · send_whatsapp`. Il giornalista è invocato.

❌ **BUCHI** — descritti sotto. Di questi, **#1 è il più grave** perché disattiva il giornalista su tutto il sistema in modo silenzioso.

---

## I 5 buchi della pipeline

### 🔴 BUG #1 — Kill-switch silenzioso `journalist_optimus_enabled=false`

In ogni punto in cui il giornalista è invocato (`generate-email`, `improve-email`, `agent-execute`, `send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue`) il codice fa:

```ts
const optimus = await loadOptimusSettings(supabase, userId);
if (optimus.enabled && finalBody) {  // ← se enabled=false, salta TUTTO
  await journalistReview(...);
}
```

Sul DB ho trovato:
```
user_id ae35ad39-…  →  journalist_optimus_enabled = "false"
```

**Conseguenza concreta:** per l'utente operativo il giornalista **non gira mai**. Email/WA/LI vanno fuori senza la review che abbiamo definito intoccabile. Mario, agent-execute, processo batch, send diretti — tutti bypassati.

Questo viola direttamente la regola appena consolidata in `mem://tech/editorial-review-layer-mandatory`.

### 🔴 BUG #2 — `agent-execute · handleSendLinkedIn` non invoca il giornalista

In `supabase/functions/agent-execute/toolHandlers/emailTools.ts`:
- `handleSendEmail` → giornalista ✅
- `handleSendWhatsApp` → giornalista ✅
- `handleSendLinkedIn` → **nessuna chiamata a `journalistReview`** ❌

Quando un agente chiama il tool LinkedIn, il messaggio salta il caporedattore.

### 🟠 BUG #3 — `pending-action-executor` chiama `send-email` con campi sbagliati

In `pending-action-executor/index.ts:209-218`:
```ts
body: JSON.stringify({
  to: ..., subject: ..., html: ...,
  user_id: action.user_id,    // ← send-email NON legge user_id, lo prende dal JWT
  partner_id: ...,
  // manca: contact_id, lead_status hint
})
```
La review parte (giusto), ma il contesto commerciale che riceve è **sempre `lead_status: "unknown"`** perché `send-email` legge solo `partner_id` parziale. Il giornalista valuta a vuoto. Stesso pattern in `cadence-engine` e in `mission-executor`.

### 🟠 BUG #4 — `_shared/platformTools/outreachHandler.ts` e `_shared/platformToolHandlers/outreachTools.ts` (usati da `ai-assistant`)

Questi 2 handler invocano `send-email` direttamente, ma:
- non passano `partner_id` né `contact_id` al body;
- non passano `journalist_reviewed`;
- la review parte ma con contesto **vuoto** (`lead_status: "unknown"`, niente partner).

Risultato: il giornalista funziona "a metà", non ha le informazioni per giudicare coerenza/fase/storia.

### 🟡 BUG #5 — `_shared/toolHandlersWrite.ts · executeSendEmail`

Stessa cosa del #4. Non passa `partner_id`/`contact_id` a send-email. Non riferisce nemmeno il post-send pipeline. Questo handler è chiamato da `ai-assistant` quando l'agente sceglie il tool generico `send_email`.

---

## Piano di fix (1 sola sessione, nessuna refactor strutturale)

Tutto il fix è **server-side** (edge functions). Il frontend non viene toccato.

### F1 — Rendere il giornalista veramente intoccabile (chiude BUG #1)

Sostituire la logica `if (optimus.enabled)` con: **il giornalista gira SEMPRE**. La chiave `journalist_optimus_enabled` resta utile solo per:
- scegliere `mode` (review_and_correct vs review_only vs silent_audit);
- scegliere `strictness` (1-10).

Cambio in 6 file:
- `supabase/functions/generate-email/index.ts` (riga 263)
- `supabase/functions/improve-email/index.ts` (riga 444)
- `supabase/functions/agent-execute/toolHandlers/emailTools.ts` (righe 65, 164)
- `supabase/functions/send-email/index.ts` — già senza flag, OK
- `supabase/functions/send-whatsapp/index.ts` — già senza flag, OK
- `supabase/functions/send-linkedin/index.ts` — già senza flag, OK
- `supabase/functions/process-email-queue/index.ts` — già senza flag, OK

E in `_shared/journalistSelector.ts` aggiornare `loadOptimusSettings` per restituire sempre `enabled:true` con `mode`/`strictness` configurabili.

In parallelo aggiorno `app_settings`:
```sql
UPDATE app_settings
SET value = 'true'
WHERE key = 'journalist_optimus_enabled';
```
così anche eventuali letture residue si comportano correttamente.

### F2 — `handleSendLinkedIn` aggiunge giornalista (chiude BUG #2)

Aggiungo in `agent-execute/toolHandlers/emailTools.ts` (handleSendLinkedIn) lo stesso blocco di `handleSendWhatsApp`, con `channel: "linkedin"`.

### F3 — Propagare `partner_id` + `contact_id` a `send-email` da tutti gli orchestratori (chiude BUG #3, #4, #5)

File da toccare:
- `supabase/functions/pending-action-executor/index.ts`
- `supabase/functions/cadence-engine/index.ts`
- `supabase/functions/mission-executor/index.ts` (per la parte che già va a send via generate)
- `supabase/functions/_shared/platformTools/outreachHandler.ts`
- `supabase/functions/_shared/platformToolHandlers/outreachTools.ts`
- `supabase/functions/_shared/toolHandlersWrite.ts` (executeSendEmail)

In ognuno: aggiungo `partner_id` e `contact_id` (quando disponibili) al body inviato a `send-email`/`send-whatsapp`/`send-linkedin`. Così il giornalista riceve il contesto vero.

### F4 — Test di regressione

Aggiungo un test in `src/test/` che monta una mock di `journalistReview` e verifica che **ognuno dei 7 punti** della pipeline lo invochi (1 chiamata per punto).

### F5 — Aggiorno la memoria

Aggiorno `mem://tech/editorial-review-layer-mandatory` con:
- "Il giornalista non ha più kill-switch utente. La sola configurazione utente sono `mode` e `strictness`."
- Lista completa dei 9 punti coperti (aggiungo handleSendLinkedIn).

---

## Cosa NON tocco

- I prompt e la KB (era il prossimo step concordato).
- Il frontend (`composeEmail`, `sendEmailDirect`, `sendWhatsapp`, `sendLinkedin` del Command già non possono bypassare).
- I tool di lettura, deep search, onboarding ecc.
- `enrich-partner-website`, `parse-business-card`, `categorize-content` — non producono messaggi outbound.

## Dopo questo fix

Procediamo con l'audit dei prompt operativi e della KB rispetto ai ruoli degli agenti, come avevi anticipato.
